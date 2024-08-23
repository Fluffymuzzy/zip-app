import path from "path";
import fs from "fs";

export const handleFileEntry = async (entry, outputDir) => {
  const fileName = entry.path;
  const type = entry.type;
  const filePath = path.join(outputDir, fileName);

  if (type === "File") {
    const buffer = await entry.buffer();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);
    return filePath;
  } else if (type === "Directory") {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true });
    }
    entry.autodrain();
    return null;
  } else {
    entry.autodrain();
    return null;
  }
};