
const whiteFiles = import.meta.glob('../assets/white_number/w_*.png', { eager: true, import: 'default' });
const yellowFiles = import.meta.glob('../assets/yellow_number/y_*.png', { eager: true, import: 'default' });

function processAssets(files) {
    const assets = {}; // Use object map or array. Array is fine since 0-9.
    for (const path in files) {
        // Expected path format ends with /w_0.png or /y_0.png
        const digitMatch = path.match(/_(\d)\.png$/);
        if (digitMatch) {
            assets[digitMatch[1]] = files[path];
            continue;
        }

        // Handle special characters
        if (path.endsWith('point.png')) {
            assets['.'] = files[path];
        } else if (path.endsWith('minus.png')) {
            assets['-'] = files[path];
        } else if (path.endsWith('plus.png')) {
            assets['+'] = files[path];
        }
    }
    return assets;
}

export const WhiteNumbers = processAssets(whiteFiles);
export const YellowNumbers = processAssets(yellowFiles);

export const getNumberAsset = (digit, type = 'white') => {
    const map = type === 'yellow' ? YellowNumbers : WhiteNumbers;
    return map[digit];
};
