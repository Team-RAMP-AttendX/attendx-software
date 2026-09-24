const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join(__dirname, '../node_modules/next/dist/server/app-render/entry-base.js'),
  path.join(__dirname, '../node_modules/next/dist/esm/server/app-render/entry-base.js'),
];

filesToPatch.forEach((filePath) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace development require of segment-explorer-node which causes RSC manifest resolution bugs
  const targetCJS = "if (process.env.NODE_ENV === 'development') {\n    const mod = require('../../next-devtools/userspace/app/segment-explorer-node');\n    SegmentViewNode = mod.SegmentViewNode;\n    SegmentViewStateNode = mod.SegmentViewStateNode;\n}";
  const replacementCJS = "SegmentViewNode = (param) => (param && param.children ? param.children : null);\nSegmentViewStateNode = () => null;\nif (false) {";

  const targetCJS2 = "if (process.env.NODE_ENV === 'development') {\n  const mod =\n    require('../../next-devtools/userspace/app/segment-explorer-node') as typeof import('../../next-devtools/userspace/app/segment-explorer-node')\n  SegmentViewNode = mod.SegmentViewNode\n  SegmentViewStateNode = mod.SegmentViewStateNode\n}";
  const replacementCJS2 = "SegmentViewNode = (param: any) => (param && param.children ? param.children : null);\nSegmentViewStateNode = () => null;\nif (false) {";

  if (content.includes("require('../../next-devtools/userspace/app/segment-explorer-node')")) {
    content = content.replace(
      /if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]development['"]\s*\)\s*\{\s*(?:const\s+mod\s*=\s*)?require\(['"]\.\.\/\.\.\/next-devtools\/userspace\/app\/segment-explorer-node['"]\)[^;]*;?\s*SegmentViewNode\s*=\s*mod\.SegmentViewNode;?\s*SegmentViewStateNode\s*=\s*mod\.SegmentViewStateNode;?\s*\}/g,
      "SegmentViewNode = (param) => (param && param.children ? param.children : null);\nSegmentViewStateNode = () => null;"
    );
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully patched ${path.basename(filePath)}`);
  }
});
