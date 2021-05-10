import { getEntropy } from "blockstack";
import { createCipher } from "blockstack/lib/encryption/aesCipher";
import { UpdateProgressCallback } from "../models/callbacks";
import { FFMpegEncryptResult, FFMpegFile, FFMpegInput, FFMpegInputType, FFMpegVideoDimension } from "../models/ffmpeg";
import { MediaMetaData } from "../models/media-meta-data";
import { createHashAddress } from "./gaia-utils";
import { readBinaryFile } from "./file-utils";
import { getImageSize } from "./image-utils";
import { VideosType, MusicType } from "./media-utils";
import { sleep } from "./time-utils";
const { createFFmpeg } = require('@ffmpeg/ffmpeg');

interface FFMPegLogCallback {
    (message: any): void
}

interface MEMFSEntry {
    name: string,
    data: any
}

function isFFMpegWasmSystemFile(name: string) {
    if (name === "."
        || name === ".."
        || name === "tmp"
        || name === "home"
        || name === "dev"
        || name === "proc") {
        return true;
    }
    return false;
}

async function encryptSegment(encKey: Buffer, iv: Buffer, plainData: Buffer) {
    const cipher = await createCipher();
    const cipherText = await cipher.encrypt(
        'aes-128-cbc',
        encKey,
        iv,
        plainData
    );
    return cipherText;
}

function clearFFMpegFileSystem(ffmpeg: any) {

    if (ffmpeg) {
        const files = ffmpeg.ls("/");
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                if (!isFFMpegWasmSystemFile(files[i])) {
                    ffmpeg.remove(files[i]);
                }
            }
        }
    }
}

export async function runFFMpegWasm(ffmpeg: any, input: FFMpegInput, args: string[], inputData: ArrayBuffer) {
    let result: any = null;
    clearFFMpegFileSystem(ffmpeg);

    ffmpeg.FS("writeFile", [input.file.name, new Uint8Array(inputData)]);
    await ffmpeg.run(args.join(' '));

    if (input.inputType !== FFMpegInputType.GetDimensions) {
        let memfs: MEMFSEntry[] = [];
        const outputFiles = ffmpeg.ls("/");
        if (outputFiles && outputFiles.length > 0) {
            for (let i = 0; i < outputFiles.length; i++) {
                if (isFFMpegWasmSystemFile(outputFiles[i])) {
                    continue;
                }
                if (outputFiles[i] === "key.info"
                    || outputFiles[i] === "key.bin"
                    || outputFiles[i] === input.file.name) {
                    continue;
                }
                const data = ffmpeg.read(outputFiles[i]);
                memfs.push({ name: outputFiles[i], data: data });
            }
            result = { MEMFS: memfs };
        }
    }
    return result;
}

function base64ToArrayBuffer(base64: string) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function runFFMpegNative(
    input: FFMpegInput,
    args: string[],
    logCallback: FFMPegLogCallback
) {
    let result: any = null;
    let foundFile = false;
    const w: any = input.element?.ownerDocument?.defaultView;
    const gaideoMessageHandler = w?.webkit?.messageHandlers?.gaideoMessageHandler;
    if (gaideoMessageHandler && input.element?.id) {
        try {
            if (input.isMusic || input.inputType === FFMpegInputType.GetDimensions) {
                const buffer = Buffer.from(input.fileData);
                gaideoMessageHandler.postMessage({
                    "type": "ffmpeg-initialize",
                    "inputData": buffer.toString("base64"),
                    "inputName": input.file.name,
                    "callbackid": input.element.id
                });
            }
            const memfs: any[] = [];
            const e: any = input.element;
            e.ffmpegDone = false;
            e.ffmpegCallback = (type: string, data: string, name?: string) => {
                if (type === "done") {
                    e.ffmpegDone = true;
                    if (foundFile) {
                        result = { MEMFS: memfs };
                    }
                }
                else if (type === "log") {
                    console.log(data);
                    logCallback({ message: data});
                }
                else if (type === "file" && name) {
                    foundFile = true;
                    const buff = base64ToArrayBuffer(data);
                    memfs.push({
                        name: name,
                        data: buff
                    });
                }
            }

            gaideoMessageHandler.postMessage({
                "type": "ffmpeg-run",
                "args": args.join(' '),
                "inputName": input.file.name,
                "callbackid": input.element.id
            });
            while (!e.ffmpegDone) {
                await sleep(1000);
            }
        }
        catch (error) {
            console.log(error);
        }
        finally {
            if (input.inputType === FFMpegInputType.Hls) {
                gaideoMessageHandler.postMessage({
                    "type": "ffmpeg-cleanup",
                    "inputName": input.file.name,
                    "callbackid": input.element.id
                });
            }

        }
    }
    return result;
}

export async function runFFMpegWorker(
    input: FFMpegInput,
    args: string[],
    inputData: ArrayBuffer,
    logCallback: FFMPegLogCallback) {

    let done = false;
    let result: any = null;

    const worker = new Worker("/scripts/workers/ffmpeg-worker-mp4.js");
    worker.onmessage = function (e) {
        const msg = e.data;
        let memfs = [
            { name: input.file.name, data: inputData }
        ];
        switch (msg.type) {
            case "ready":
                worker.postMessage({
                    MEMFS: memfs,
                    type: "run",
                    arguments: args
                });
                break;
            case "stdout":
                console.log(msg.data);
                logCallback({
                    message: msg.data,
                    type: 'ffmpeg-stdout'
                });
                break;
            case "stderr":
                console.log(msg.data);
                logCallback({
                    message: msg.data,
                    type: 'ffmpeg-stderr'
                });
                break;
            case "done":
                done = true;
                if (input.inputType !== FFMpegInputType.GetDimensions) {
                    result = msg.data;
                }
                break;
        }
    }
    while (!done) {
        await sleep(1000);
    }
    return result;
}

function supportsSharedArrayBuffer() {
    try {
        new SharedArrayBuffer(10);
        return true;
    }
    catch {

    }
    return false;
}

export async function canRunWebAssembly() {
    if (!supportsSharedArrayBuffer()) {
        return false;
    }
    try {
        let str = localStorage.getItem("CanRunWebAssembly");
        if (str === 'true') {
            return true;
        }
        else if (str === 'false') {
            return false;
        }
        else {
            try {
                if (typeof WebAssembly === "object"
                    && typeof WebAssembly.instantiate === "function") {
                    const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
                    if (module instanceof WebAssembly.Module)
                        if (new WebAssembly.Instance(module) instanceof WebAssembly.Instance) {
                            localStorage.setItem("CanRunWebAssembly", "true");
                            return true;
                        }
                }
            } catch (e) {
            }
            return false;
        }
    }
    catch {
        localStorage.setItem("CanRunWebAssembly", "false");
    }
    return false;
}

function getArgsFromInput(input: FFMpegInput): string[] {
    switch (input.inputType) {
        case FFMpegInputType.GetDimensions:
            return ["-y", "-i", `${input.file.name}`];
        case FFMpegInputType.Hls:
            if (input.dimensions) {
                return ["-y", "-i", `${input.file.name}`,
                    "-c:v", "libx264", "-profile:v", "high10", "-level", "4.2", "-crf", "20",
                    "-g", "48", "-keyint_min", "48",
                    "-vf", `scale=-1:${input.dimensions.height}`, "-start_number", "0",
                    "-hls_time", input.isMusic ? "30" : "4", "-hls_list_size", "0", "-f", "hls",
                    /*"-hls_key_info_file", "key.info",*/ `video${input.dimensions.height}-stream.m3u8`,
                ];
            }
            break;
        case FFMpegInputType.PreviewImage:
            if (input.output) {
                let w = 400;
                let h = 300;
                if (input.dimensions && input.dimensions.height > 0 && input.dimensions.width > 0) {
                    w = input.dimensions.width;
                    h = input.dimensions.height;
                }
                return ["-y", "-i", `${input.file.name}`, "-an", "-ss", "5", "-vframes", "1", "-s", `${w}x${h}`, input.output];
            }
            break;
    }
    return new Array<string>();
}

export async function runFFMeg(input: FFMpegInput, handleLogMessage: FFMPegLogCallback) {
    let result: any = {
        result: null,
        error: ''
    };

    let args = getArgsFromInput(input);
    if (args.length > 0) {
        const w: any = input.element?.ownerDocument?.defaultView;
        let gaideoMessageHandler: any = w?.webkit?.messageHandlers?.gaideoMessageHandler
        if (gaideoMessageHandler) {
            result.result = await runFFMpegNative(input, args, handleLogMessage);
        }
        else if (input.ffmpeg) {
            result.result = await runFFMpegWasm(input.ffmpeg, input, args, input.fileData);

        }
        else {
            result.result = await runFFMpegWorker(input, args, input.fileData, handleLogMessage);
        }
    }
    else {
        result.error = 'Invalid arguments for ffmpeg input.';
    }
    return result;
}

export function createM3u8Data(dimensions: FFMpegVideoDimension | null | undefined) {
    let mp3uText;
    if (!dimensions) {
        mp3uText = `\
#EXTM3U\n\
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2000000,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=1280x720,NAME="720"\n\
video720-stream.m3u8\n\
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=500000,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=426x240,NAME="240"\n\
video240-stream.m3u8\n\
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1000000,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=640x360,NAME="360"\n\
video360-stream.m3u8\n\
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1500000,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=852x480,NAME="480"
video480-stream.m3u8\n`
    }
    else {
        let bandwidth = 2000000;
        if (dimensions.height < 360) {
            bandwidth = 500000;
        }
        else if (dimensions.height < 480) {
            bandwidth = 1000000;
        }
        else if (dimensions.height < 720) {
            bandwidth = 1500000;
        }
        mp3uText = `\
#EXTM3U\n\
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=${bandwidth},CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=${dimensions.width}x${dimensions.height},NAME="${dimensions.height}"\n\
video${dimensions.height}-stream.m3u8\n`
    }
    var enc = new TextEncoder();
    return new Uint8Array(enc.encode(mp3uText));
}

export function isMusicFile(name: string) {
    if (name.toLowerCase().endsWith('.mp3')) {
        return true;
    }
    return false;
}

export function computeNameFromImageFile(videoFileName: string) {
    if (isMusicFile(videoFileName)) {
        return 'music.png'
    }
    else {
        let index = videoFileName.lastIndexOf(".");
        let ret = videoFileName;
        if (index >= 0) {
            ret = videoFileName.substring(0, index);
        }
        return ret;
    }

}
const computePreviewFileName = (videoFileName: string) => {
    return `${computeNameFromImageFile(videoFileName)}_preview.jpg`;
}

export async function convertVideoToHls(
    inputMetaData: MediaMetaData,
    file: any,
    encrypt: boolean,
    updateProgress: UpdateProgressCallback,
    element?: HTMLElement): Promise<FFMpegEncryptResult> {
    let metaData: MediaMetaData = { ...inputMetaData, previewImageName: undefined };
    let hlsFiles: FFMpegFile[] = [];

    let dimWidth: number = 0;
    let dimHeight: number = 0;
    let isRotated: boolean = false;
    let duration = '';
    const dimensionRegex = /Stream.+,\s*([0-9]{3,5}x[0-9]{3,5})/g;
    const rotateRegex = /rotate\s*:\s*([0-9]+)/g;
    const durationRegex = /Duration:\s*([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{2,})/g
    const timeRegex = /\s+time=([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{2,})/g

    let isMusic = isMusicFile(file.name);
    let gettingDimensions = false;
    let encoding = false;
    let encodingMessage = `${encrypt ? "Encrypting" : "Transcoding"} video.  This may take a while depending on the size...`;

    const handleLogMessage = (e: any) => {
        if (!duration) {
            const durationResult = durationRegex.exec(e.message);
            if (durationResult?.length === 2) {
                duration = durationResult[1];
            }
        }
        if (gettingDimensions) {
            const dimResult = dimensionRegex.exec(e.message);
            if (dimResult?.length === 2) {
                let xIdx = dimResult[1].indexOf('x');
                dimWidth = parseInt(dimResult[1].substring(0, xIdx));
                dimHeight = parseInt(dimResult[1].substring(xIdx + 1));
                if (isRotated) {
                    let tmp = dimWidth;
                    dimWidth = dimHeight;
                    dimHeight = tmp;
                }
            }
            else {
                const rotateResult = rotateRegex.exec(e.message);
                if (rotateResult?.length === 2) {
                    if (rotateResult[1] === "90") {
                        isRotated = true;
                        if (dimWidth > 0) {
                            let tmp = dimWidth;
                            dimWidth = dimHeight;
                            dimHeight = tmp;
                        }
                    }
                }
            }
        }
        else if (encoding && e.message?.indexOf("time=") >= 0) {
            const timeResult = timeRegex.exec(e.message);
            if (timeResult?.length === 2 && duration) {
                updateProgress(encodingMessage, `Current time: ${timeResult[1]}, Duration: ${duration}`);
            }
        }
    }

    let ffmpeg: any;
    const w: any = element?.ownerDocument?.defaultView;
    if (!(w?.webkit?.messageHandlers?.gaideoMessageHandler)) {
        const canRun = await canRunWebAssembly();
        if (canRun) {
            ffmpeg = createFFmpeg({
                corePath: "/scripts/workers/ffmpeg-core.js",
                log: true,
                logger: handleLogMessage
            });
            await ffmpeg.load();
        }
    }

    if (inputMetaData.previewImageName) {
        let keyData = getEntropy(32);
        let ivData = getEntropy(16);
        let ivHexData = ivData.toString('hex');
        let dimensions: FFMpegVideoDimension | null | undefined;
        let data = await readBinaryFile(file);
        let result: any = null;
        if (isMusic) {
            dimHeight = 192;
            dimWidth = 192;
            result = {};
        }
        else {
            gettingDimensions = true;
            updateProgress(`Getting video dimensions for ${file.name}...`, null);
            result = await runFFMeg({
                file: file,
                fileData: data,
                inputType: FFMpegInputType.GetDimensions,
                ffmpeg: ffmpeg,
                element: element
            }, handleLogMessage);
            gettingDimensions = false;
        }
        if (!result.error) {
            if (dimHeight > 0 && dimWidth > 0) {
                if (dimHeight > 720 || dimWidth > 1280) {
                    let maxHeight = 720;
                    let size = getImageSize(dimWidth, dimHeight, 1280, maxHeight);
                    let w = Math.round(size[0]);
                    let h = Math.round(size[1]);

                    while (maxHeight > 0 && ((w % 2) === 1 || (h % 2) === 1)) {
                        maxHeight -= 2;
                        size = getImageSize(dimWidth, dimHeight, 1280, maxHeight);
                        w = Math.round(size[0]);
                        h = Math.round(size[1]);
                    }
                    dimensions = {
                        width: w,
                        height: h
                    }

                }
                else {
                    dimensions = {
                        width: dimWidth,
                        height: dimHeight
                    }
                }
            }
            let subMessage: string | null = null;
            if (isMusic) {
                subMessage = `Music file detected. Skipping preview image generation.`
            }
            else if (dimensions) {
                subMessage = `Video size: ${dimWidth}x${dimHeight}, Image size: ${dimensions?.width}.${dimensions?.height}`
                updateProgress(`Generating preview image...`, subMessage);
                result = await runFFMeg({
                    file: file,
                    fileData: data,
                    inputType: FFMpegInputType.PreviewImage,
                    output: computePreviewFileName(inputMetaData.previewImageName),
                    dimensions: dimensions,
                    ffmpeg: ffmpeg,
                    element: element
                }, handleLogMessage);
            }
            let memfs = result.result?.MEMFS;
            if (isMusic || (!result.error && memfs?.length > 0 && !result.error)) {
                if (isMusic) {
                    metaData.id = createHashAddress([metaData.id]);
                    metaData.previewImageName = `music.png`;
                }
                else {
                    let previewFile = memfs[0];
                    if (!memfs[0].name.endsWith("_preview.jpg")) {
                        previewFile = { ...memfs[0], name: `${memfs[0].name}_preview.jpg` }
                    }
                    hlsFiles.push(previewFile);
                    metaData.id = createHashAddress([metaData.id, previewFile.name.replace('_preview.jpg', '')]);
                    metaData.previewImageName = `videos/${metaData.id}/${previewFile.name}`;
                }
                if (!dimensions || !dimensions.height || !dimensions.width) {
                    throw Error("Unable to determine size of the input video.")
                }
                encoding = true;
                updateProgress(encodingMessage, null);
                result = await runFFMeg({
                    file: file,
                    fileData: data,
                    inputType: FFMpegInputType.Hls,
                    output: `video${dimensions.height}-stream.m3u8`,
                    dimensions: dimensions,
                    ffmpeg: ffmpeg,
                    element: element,
                    isMusic: isMusic
                }, handleLogMessage);
                encoding = false;
                if (!result.error) {
                    memfs = result.result?.MEMFS;
                    if (memfs?.length > 0) {
                        for (let i = 0; i < memfs.length; i++) {
                            if (memfs[i].name.endsWith(".m3u8")) {
                                let masterData = Buffer.from(memfs[i].data);
                                if (encrypt) {
                                    let masterText = masterData.toString("utf-8");
                                    masterText = masterText.replace("#EXT-X-MEDIA-SEQUENCE:0", `#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-KEY:METHOD=AES-128,URI="gaideo://gaideo.com/key.bin",IV=0x${ivHexData}`)
                                    masterData = Buffer.from(masterText, "utf-8");
                                }
                                hlsFiles.push({
                                    name: "master.m3u8",
                                    data: masterData
                                })
                            }
                            else {
                                let segmentData = Buffer.from(memfs[i].data);
                                if (encrypt) {
                                    segmentData = await encryptSegment(keyData, ivData, segmentData);
                                }
                                hlsFiles.push({
                                    name: memfs[i].name,
                                    data: segmentData
                                });
                            }
                        }
                        if (encrypt) {
                            hlsFiles.push({
                                name: "key.bin",
                                data: keyData
                            });
                        }

                        metaData.manifest = hlsFiles.map(x => x.name);
                        metaData.type = isMusic ? MusicType : VideosType;
                        return {
                            metaData: metaData,
                            hlsFiles: hlsFiles
                        }

                    }
                    else {
                        return { errorMessage: "Unknown error. No encoded HLS files were generated." }
                    }

                }
            }
            else {
                return { errorMessage: 'Unknown error. Could not generate preview image.' }
            }
        }
        return { errorMessage: result.error };
    }
    else {
        return { errorMessage: "No preview image name specified." };
    }

}
