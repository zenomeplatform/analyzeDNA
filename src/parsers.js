const fs = require("fs");
const readline = require("readline");
const stream = require("stream");

const parse_gvcf_file = (filename, temp_folder) => {
  return new Promise((resolve, reject) => {
    const instream = fs.createReadStream(filename);
    const outstream = new stream();
    const rl = readline.createInterface(instream, outstream);

    const max_lines_count = 10000;

    const header_file = fs.createWriteStream(`${temp_folder}/headers.txt`);
    let header_done = false;

    const setCurrentStream = (chr, number) => {
      return fs.createWriteStream(`${temp_folder}//file_${chr}_${number}.txt`);
    };

    let mapper = {};

    let currentChr = "";
    let chr_files_count = 0;
    let line_count = 0;
    let currentStream = null;
    let bytes_position = 0;

    rl.on("line", line => {
      // process line here

      if (!header_done) {
        if (line[0] == "#") {
          header_file.write(`${line}\n`);
          return;
        } else {
          header_done = false;
          header_file.end();
        }
      }

      tabs = line.split("\t");
      if (tabs[0] == currentChr) {
        if (line_count == max_lines_count) {
          currentStream.end();
          line_count = 0;
          chr_files_count++;
          bytes_position = 0;
          currentStream = setCurrentStream(tabs[0], chr_files_count);
        }
      } else {
        currentChr = tabs[0];
        if (currentStream) {
          currentStream.end();
        }
        mapper[currentChr] = [];
        chr_files_count = 0;
        bytes_position = 0;
        currentStream = setCurrentStream(tabs[0], 0);
      }
      currentStream.write(`${line}\n`);
      const info = tabs[7].split(";");
      const end = info.find(i => i.slice(0, 3) == "END");
      let to_mapper = [
        chr_files_count,
        bytes_position,
        line.length,
        parseInt(tabs[1])
      ];
      if (end) to_mapper.push(parseInt(end.slice(4)));
      mapper[tabs[0]].push(to_mapper);
      line_count++;
      bytes_position += line.length + 1;
    });

    rl.on("close", () => {
      console.log("Done parsing");
      resolve(mapper);
      fs.writeFileSync(`${temp_folder}/mapping.json`, JSON.stringify(mapper));
    });
  });
};
module.exports.parse_gvcf_file = parse_gvcf_file;
