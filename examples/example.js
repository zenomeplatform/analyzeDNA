const utils = require("../src/utils");
const parser = new utils.gvcfParser(
  "./input/data/Vip72.fastq.gvcf",
  "./input/temp",
  "./input/ref/hg19_karyo_order.fa.txt",
  "./input/ref/hg19_karyo_order.fa.fai.txt"
);
parser.parse_source().then(() => {
  // getting gene from *.gvcf file
  console.log(parser.get_gene("chr1", 17000));
  // getting reference gene
  console.log(parser.get_ref("chr1", 17000));
});
