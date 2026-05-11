const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const metaPath = path.join(root, 'src', 'meta.js');
const orderPath = path.join(root, 'src', 'module-order.json');
const outputPath = path.join(root, 'Ns.js');
const userOutputPath = path.join(root, 'Ns.user.js');

const meta = fs.readFileSync(metaPath, 'utf8').trimEnd();
const order = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
const body = order.map(file => fs.readFileSync(path.join(root, file), 'utf8').trimEnd()).join('\n\n');
const output = meta + "\n\n(function () {\n    'use strict';\n\n" + body + "\n\n})();\n";
fs.writeFileSync(outputPath, output);
fs.writeFileSync(userOutputPath, output);
console.log('built Ns.js and Ns.user.js from ' + order.length + ' modules');
