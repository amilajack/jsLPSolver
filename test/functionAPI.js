/*global describe*/
/*global require*/
/*global module*/
/*global it*/
/*global console*/
/*global process*/

import assert from 'assert';

import JSLP from '../src/solver';
const Model = JSLP.Model;

describe("Testing Function API", () => {

    it("should be able to construct and solve model 1", () => {
        //-------------------------------------------
        // MODEL 1
        //-------------------------------------------
        const model1 = new Model(1e-8, "model 1").maximize();

        const x1 = model1.addVariable(-4, "x1");
        const x2 = model1.addVariable(-2, "x2");
        const x3 = model1.addVariable( 1, "x3");

        const cst1 = model1.smallerThan(-3).addTerm(-1, x1).addTerm(-1, x2).addTerm( 2, x3);
        let cst2 = model1.smallerThan(-4).addTerm(-4, x1).addTerm(-2, x2).addTerm( 1, x3);
        cst2 = model1.smallerThan( 2).addTerm( 1, x1).addTerm( 1, x2).addTerm(-4, x3);

        const solution1 = model1.solve();
        assert.deepEqual(solution1.evaluation, -7.5);
        assert.deepEqual(x1.value, 0);
        assert.deepEqual(x2.value, 4);
        assert.deepEqual(x3.value, 0.5);
    });


    it("should be able to construct and solve model 2", () => {
        //-------------------------------------------
        // MODEL 2
        //-------------------------------------------
        const model2 = new Model(1e-8, "model 2").minimize();

        const x1 = model2.addVariable(3);
        const x2 = model2.addVariable(2);

        const cst1 = model2.greaterThan(3).addTerm(1, x1).addTerm(1, x2);
        const cst2 = model2.greaterThan(4).addTerm(2, x1).addTerm(1, x2);

        const solution2 = model2.solve();
        assert.deepEqual(solution2.evaluation, 7);
        assert.deepEqual(x1.value, 1);
        assert.deepEqual(x2.value, 2);
    });
});
