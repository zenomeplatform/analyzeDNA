const parsers = require("./parsers");
const refDir = "./input/ref";
const fs = require("fs");
//destination of reference files
const ref_file_name = `${refDir}/hg19_karyo_order.fa.txt`;
const ref_file_index_name = `${refDir}/hg19_karyo_order.fa.fai.txt`;

const get_ref_index = filename => {
  const ref_file = fs.readFileSync(filename, "utf8", "r");
  let ref = {};
  ref_file.split("\n").forEach(ref_string => {
    const data = ref_string.split("\t");
    if (data[0]) {
      Object.assign(ref, {
        [data[0]]: {
          length: parseInt(data[1]),
          offset: parseInt(data[2]),
          string_length: parseInt(data[3])
        }
      });
    }
  });
  return ref;
};

class gvcfParser {
  constructor(
    filename,
    folder,
    ref_file_name = ref_file_name,
    ref_file_index_name = ref_file_index_name
  ) {
    this.source_file = filename;
    this.files = {};
    this.ref_index = get_ref_index(ref_file_index_name);
    this.ref_file = fs.openSync(ref_file_name, "r");

    //temp folder, where splitted gvcf files will be stored
    this.folder = folder;
  }

  // Parsing function, should be executed after constructor
  parse_source() {
    return new Promise(resolve => {
      Promise.resolve(
        parsers.parse_gvcf_file(this.source_file, this.folder)
      ).then(data => {
        this.mapper = data;
        Object.keys(data).forEach(key => {
          if (key) {
            this.files[key] = {};
          }
        });
        resolve("Done");
      });
    });
  }

  read_gvcf_line(chr, file_id, offset, length) {
    if (!this.files[chr].gvsf_file) {
      this.files[chr].gvsf_file = fs.openSync(
        `${this.folder}/file_${chr}_${file_id}.txt`,
        "r"
      );
    }
    const buffer = new Buffer(length);
    fs.readSync(this.files[chr].gvsf_file, buffer, 0, length, offset);
    return buffer.toString("utf8");
  }

  //Getting quality of gene reading
  get_qual(filter, dp) {
    // best: 3
    // good: 2
    // mediocore: 1
    // bad: 0
    if (filter == "PASS") {
      if (dp > 50) return 3;
      if (dp <= 50 && dp > 20) return 2;
      if (dp >= 8) return 1;
      return 0;
    } else {
      if (dp >= 8) {
        return 1;
      } else {
        return 0;
      }
    }
  }

  //Getting gen reference
  get_ref(chr, position) {
    const offset =
      this.ref_index[chr].offset +
      ((position / this.ref_index[chr].string_length) >> 0) *
        (this.ref_index[chr].string_length + 1) +
      position % this.ref_index[chr].string_length;
    const buffer = new Buffer(1);

    fs.readSync(this.ref_file, buffer, 0, 1, offset);
    return buffer.toString("utf8");
  }

  //
  get_gene(chr, position) {
    const line = this.get_gvsf_string(chr, position);
    if (!line) {
      return null;
    }
    const tabs = line.split("\t");
    const info = tabs[7].split(";");

    const names_splitted = tabs[8].split(":");
    const values_splitted = tabs[9].split(":");
    let format = {};
    names_splitted.forEach((value, index) => {
      format[value] = values_splitted[index];
    });

    let result = {
      chr: chr,
      position: position,
      qual: this.get_qual(tabs[6], format.DP)
    };

    if (info.find(i => i.slice(0, 3) == "END")) {
      result.gene = this.get_ref(chr, position).repeat(2);
    } else {
      if (info.find(i => i.slice(0, 4) == "INDEL")) {
        result.gene = tabs[4].toUpperCase();
      } else {
        const genes = [tabs[3], ...tabs[4].split(",")];
        result.gene =
          genes[parseInt(format.GT[0])] + genes[parseInt(format.GT[2])];
      }
    }
    return result;
  }
  get_gvsf_string(chr, position) {
    let low = 0;
    let high = this.mapper[chr].length;
    let exact = false;
    let mid = 0;
    while (low < high) {
      mid = (low + high) >>> 1;
      if (this.mapper[chr][mid][3] < position) {
        low = mid + 1;
      } else if (this.mapper[chr][mid][3] == position) {
        exact = true;
        break;
      } else high = mid;
    }
    if (
      exact ||
      (this.mapper[chr][mid].length == 5 &&
        this.mapper[chr][mid][4] >= position &&
        this.mapper[chr][mid][3] < position)
    ) {
      const line = this.mapper[chr][mid];
      return this.read_gvcf_line(chr, line[0], line[1], line[2]);
    } else {
      return null;
    }
  }
}
module.exports.gvcfParser = gvcfParser;
