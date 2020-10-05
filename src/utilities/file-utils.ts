
export function readTextFile(inputFile: Blob): Promise<string> {

    let temporaryFileReader = new FileReader();

    return new Promise((resolve, reject) => {
        temporaryFileReader.onerror = () => {
            temporaryFileReader.abort();
            reject(new DOMException("Problem parsing input file."));
        };

        temporaryFileReader.onload = () => {
            resolve(temporaryFileReader.result as string);
        };
        temporaryFileReader.readAsText(inputFile);
    });
}

export function readBinaryFile(inputFile: Blob): Promise<ArrayBuffer> {

    let temporaryFileReader = new FileReader();

    return new Promise((resolve, reject) => {
        temporaryFileReader.onerror = () => {
            temporaryFileReader.abort();
            reject(new DOMException("Problem parsing input file."));
        };

        temporaryFileReader.onload = () => {
            resolve(temporaryFileReader.result as ArrayBuffer);
        };
        temporaryFileReader.readAsArrayBuffer(inputFile);
    });
}

