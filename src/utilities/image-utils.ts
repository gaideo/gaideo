
export function getImageSize(aspectWidth: number, aspectHeight: number, width: number, height: number) {
    let x = height * aspectWidth / aspectHeight;
    let y = width - x;
    let nw = width - y;
    let nh = height;
    if (nw > width) {
        nw = width;
        let a = aspectHeight * nw / aspectWidth;
        let b = height - a;
        nh = height - b;
    }
    return [nw, nh];

}
