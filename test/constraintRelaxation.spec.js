import assert from 'assert';
import JSLP from '../src/solver';
const Model = JSLP.Model;

describe("Testing Model Relaxation", () => {

    it("should be able to construct and solve relaxed model 1", () => {
		//-------------------------------------------
		// IMPOSSIBLE MODEL
		//-------------------------------------------
		const model1 = new Model(1e-8, "model 1").maximize();

		const x1 = model1.addVariable(3, "x1", false, false, 1);
		const x2 = model1.addVariable(5, "x2", false, false, 1);

		const cst11 = model1.equal(8).addTerm(1, x1).addTerm(1, x2);
		const cst12 = model1.equal(18).addTerm(3, x1).addTerm(2, x2);
		const cst13 = model1.equal(32).addTerm(5, x1).addTerm(4, x2);
		const cst14 = model1.equal(4).addTerm(4, x1).addTerm(-1, x2);
		const cst15 = model1.greaterThan(6).addTerm(1, x2);

		//-------------------------------------------
		// SOLVING ONCE
		//-------------------------------------------
		const solution1 = model1.solve();
		assert.deepEqual(solution1.feasible, false);

		//-------------------------------------------
		// RELAXING CONSTRAINTS
		//-------------------------------------------
		const weight11 = 1;
		const weight12 = 2;
		const weight13 = 5;
		const weight14 = 2;
		cst11.relax(weight11, 1);
		cst12.relax(weight12, 1);
		cst13.relax(weight13, 1);
		cst14.relax(weight14, 1);

		//-------------------------------------------
		// SOLVING RELAXED MODEL
		//-------------------------------------------
		const solution2 = model1.solve();
		assert.deepEqual(solution2.feasible, true);
		assert.deepEqual(solution2.evaluation, 0);
		assert.deepEqual(x1.value, 1.6);
		assert.deepEqual(x2.value, 6);
		assert.deepEqual(cst11.relaxation.value, 0.4);
		assert.deepEqual(cst12.relaxation.value, 1.2);
		assert.deepEqual(cst13.relaxation.value, 0);
		assert.deepEqual(cst14.relaxation.value, 3.6);
	});


    it("should be able to construct and solve relaxed model 2", () => {
		//-------------------------------------------
		// IMPOSSIBLE MODEL
		//-------------------------------------------
		const model2 = new Model(1e-8, "model 2");

		const x1 = model2.addVariable(0, "x1");
		const x2 = model2.addVariable(0, "x2");

		// Strong priority constraints
		const cst21 = model2.smallerThan(6).addTerm(2, x1).addTerm(1, x2);

		// Medium priority constraints
		const cst22 = model2.greaterThan(2).addTerm(1, x2);

		// Weak priority constraints
		const cst23 = model2.greaterThan(3).addTerm(3, x1).addTerm(-4, x2);
		const cst24 = model2.smallerThan(10).addTerm(5, x1).addTerm(2, x2);
		const cst25 = model2.smallerThan(-5).addTerm(1, x1).addTerm(-3, x2);

		//-------------------------------------------
		// SOLVING ONCE
		//-------------------------------------------
		const solution1 = model2.solve();
		assert.deepEqual(solution1.feasible, false);

		//-------------------------------------------
		// RELAXING CONSTRAINTS
		//-------------------------------------------
		const weight21 = 1;
		const weight22 = 1;
		const weight23 = 10;
		const weight24 = 40;
		const weight25 = 20;
		cst21.relax(weight21, "strong");
		cst22.relax(weight22, "medium");
		cst23.relax(weight23, "weak");
		cst24.relax(weight24, "weak");
		cst25.relax(weight25, "weak");

		//-------------------------------------------
		// SOLVING RELAXED MODEL
		//-------------------------------------------
		const solution2 = model2.solve();
		assert.deepEqual(solution2.feasible, true);
		assert.deepEqual(solution2.evaluation, 0);
		assert.deepEqual(x1.value, 1.17647059);
		assert.deepEqual(x2.value, 2.05882353);
		assert.deepEqual(cst21.relaxation.value, 0);
		assert.deepEqual(cst22.relaxation.value, 0);
		assert.deepEqual(cst23.relaxation.value, 7.70588235);
		assert.deepEqual(cst24.relaxation.value, 0);
		assert.deepEqual(cst25.relaxation.value, 0);
	});
});
