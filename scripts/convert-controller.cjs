const fs = require('node:fs');
const crypto = require('node:crypto');
(async () => {
 fs.mkdirSync('tmp',{recursive:true});
 const occt = await require('occt-import-js')();
 const source = fs.readFileSync('references/source/controller-0916.stp');
 const result = occt.ReadStepFile(source, {linearUnit:'meter',linearDeflectionType:'absolute_value',linearDeflection:0.00012,angularDeflection:0.18});
 if(!result.success)throw new Error('STEP conversion failed');
 fs.writeFileSync('tmp/controller-cad.json',JSON.stringify(result));
 console.log(`Converted ${result.meshes.length} CAD meshes.`);
 fs.writeFileSync('tmp/source-hash.txt',crypto.createHash('sha256').update(source).digest('hex'));
})();
