/*global describe*/
/*global require*/
/*global it*/
/*global console*/
/*global process*/



import walk from 'walk';

import fs from 'fs';
import solver from '../src/solver';

const problems = [];

// Parsing test problems
const walker = walk.walkSync("../test/problems", {
    followLinks: false,
    listeners: {
        file(root, fileStats) {
            // Add this file to the list of files
            const fileName = fileStats.name;
            console.log("fileName", fileName);

            // Ignore files that start with a "."
            if (fileName[0] === ".") {
                return;
            }

            const fileRoot = root.substr("test/problems".length + 1);
            const fullFilePath = `./${root}/${fileName}`;
            const jsonContent = JSON.parse(fs.readFileSync(fullFilePath));
            problems.push(jsonContent);
        }
    }
});



console.log("------------------------");
console.log("-FORWARD-");
console.log("------------------------");

const log = {};


for (var i = 0; i < problems.length; i++) {
    const k = 0;
    var j = problems[i];


    log[j.name] = {};

    for(const constraint in j.constraints){
        if(j.constraints[constraint].max){
            log[j.name].constraints = log[j.name].constraints  || 0;
            log[j.name].constraints++;
        }

        if(j.constraints[constraint].min){
            log[j.name].constraints = log[j.name].constraints  || 0;
            log[j.name].constraints++;
        }
    }

    log[j.name].variables = Object.keys(j.variables).length;

    if(j.ints){
        log[j.name].ints = Object.keys(j.ints).length;
    }
}

for( i = 0; i < problems.length; i++){
    j = problems[i];
    const date_0 = process.hrtime();
    const d = solver.Solve(j, 1e-8, true);
    const a = process.hrtime(date_0);

    log[j.name] = d;
    log[j.name].time =  a[0] + a[1] / 1e9;

}

console.log(log);
