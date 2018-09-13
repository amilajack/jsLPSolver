/*global describe*/
/*global require*/
/*global it*/
/*global console*/

import assert from 'assert';

import walk from 'walk';
import fs from 'fs';

const problems = [];

// Parsing test problems
const walker = walk.walkSync("test/problems", {
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

// Kick off the second "Monster" problem
//problems.splice(-1,1);

function assertSolution(model, solutionA, solutionB) {
    // If the problem is feasible but the solution isn't then failure
    // Else if they are both unfeasible then success
    if (solutionA.feasible !== solutionB.feasible){
        return assert.deepEqual({ feasible: solutionA.feasible }, { feasible: solutionB.feasible });
    } else if (!solutionA.feasible) {
        return assert.deepEqual({ feasible: solutionA.feasible }, { feasible: solutionB.feasible });
    }

    const solutionAIsBounded = solutionA.bounded === undefined ? true : solutionA.bounded;
    const solutionBIsBounded = solutionB.bounded === undefined ? true : solutionB.bounded;
    if (solutionAIsBounded !== solutionBIsBounded){
        return assert.deepEqual({ bounded: solutionAIsBounded }, { bounded: solutionBIsBounded });
    } else if (!solutionAIsBounded) {
        return assert.deepEqual({ bounded: solutionAIsBounded }, { bounded: solutionBIsBounded });
    }

    // If the expected evaluation of the objective function is different from the actual evaluation then failure
    if (solutionA.result.toFixed(6) !== solutionB.result.toFixed(6)){
        return assert.deepEqual(
            { ObjectiveFunctionEvaluation: solutionA.result.toFixed(6) },
            { ObjectiveFunctionEvaluation: solutionB.result.toFixed(6) }
        );
    }

    // More accurate way to compute the adequate precision ?
    const precision = 1e-6;
    const tableau = model.tableau;

    // Check if all the constraints are respected
    for (const constraint of model.constraints) {
        let lhs = 0;

        for (const term of constraint.terms) {
            lhs += term.variable.value * term.coefficient;
        }

        if (constraint.isUpperBound && constraint.rhs - lhs <= -precision) {
            return assert.deepEqual({ upperBoundConstraint: lhs }, { upperBoundConstraint: constraint.rhs });
        } else if (!constraint.isUpperBound && constraint.rhs - lhs >= precision) {
            return assert.deepEqual({ lowerBoundConstraint: lhs }, { lowerBoundConstraint: constraint.rhs });
        }
    }

    return assert.deepEqual(true, true);
}

// Build out our test suite
describe("The Solve method takes a problem and solves it",
    () => {
        const solver = require("../src/solver");
        // Iterate over each problem in the suite
        problems.forEach(jsonModel => {
            // Generic "Should" Statement
            // (should come up with a better test scheme and description...)
            it(`should be able to solve the ${jsonModel.name}`,
                function () {
                    // Look to see if the JSON Model's "expects"
                    // has a "_timeout". If so, set it and delete it (to not
                    // interfere with any test expectations)
                    if(jsonModel.expects._timeout){
                        this.timeout(jsonModel.expects._timeout);
                        delete jsonModel.expects._timeout;
                    }


                    // Each problem has its correct answer attached to its
                    // JSON as an "expects" object
                    const expectedResult = jsonModel.expects;

                    const obtainedResult = solver.Solve(jsonModel);

                    const model = solver.lastSolvedModel;

                    // Compare what we expect the problem to be
                    // to what solver comes up with
                    assertSolution(
                        model,
                        obtainedResult,
                        expectedResult
                    );
                });
        });
    });
