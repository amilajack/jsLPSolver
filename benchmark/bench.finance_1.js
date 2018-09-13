/*global describe*/
/*global require*/
/*global it*/
/*global console*/
/*global process*/


import fs from 'fs';

import solver from '../src/solver';
/*global describe*/
/*global require*/
/*global it*/
/*global console*/
/*global process*/


const //.push(require("./test_suite/SPY_SPY_SPY_20150918.json")),
problems = [];

problems.push(require("./test_suite/SPY_SPY_SPY_20150918.json"))
console.log(problems.length);


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
