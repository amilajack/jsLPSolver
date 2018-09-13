/*global require*/
/*global describe*/
/*global it*/

import assert from 'assert';

import solver from '../src/main.js';

describe("Testing if optional objectives are taken into account", () => {

	it("should be able to construct and solve UI model", () => {

		// Elements composing the UI
		let nUIElements = 0;
		function UIElement(model){
			this.x = model.addVariable(0, `x${nUIElements}`, false, false);
			this.y = model.addVariable(0, `y${nUIElements}`, false, false);

			this.w = model.addVariable(0, `w${nUIElements}`, false, false);
			this.h = model.addVariable(0, `h${nUIElements}`, false, false);

			this.id = nUIElements;

			nUIElements += 1;
		}


		function setMinW(model, element, minW){
			return [model.greaterThan(minW).addTerm(1, element.w)];
		}
		function setMaxW(model, element, maxW){
			return [model.smallerThan(maxW).addTerm(1, element.w)];
		}
		function setMinH(model, element, minH){
			return [model.greaterThan(minH).addTerm(1, element.h)];
		}
		function setMaxH(model, element, maxH){
			return [model.smallerThan(maxH).addTerm(1, element.h)];
		}

		function setMinX(model, element, minX){
			return [model.greaterThan(minX).addTerm(1, element.x)];
		}
		function setMaxX(model, element, maxX){
			return [model.smallerThan(maxX).addTerm(1, element.x)];
		}
		function setMinY(model, element, minY){
			return [model.greaterThan(minY).addTerm(1, element.y)];
		}
		function setMaxY(model, element, maxY){
			return [model.smallerThan(maxY).addTerm(1, element.y)];
		}

		function noOverlap(model, element1, element2){
			const constraintSet = [];

			const x1 = element1.x;
			const y1 = element1.y;
			const x2 = element2.x;
			const y2 = element2.y;

			const w1 = element1.w;
			const h1 = element1.h;
			const w2 = element2.w;
			const h2 = element2.h;

			const MWidth = 1920;
			const MHeight = 1080;

			// "a" variables are activation variables

			// Element 1 can either be...

			// ... on the left of element 2
			const a1 = model.addVariable(0, `${element1.id}_onLeftOf_${element2.id}`, true, false);
			constraintSet.push(model.smallerThan(0).addTerm(1, x1).addTerm(1, w1).addTerm(-1, x2).addTerm(-MWidth, a1));

			// ... above element 2
			const a2 = model.addVariable(0, `${element1.id}_above_${element2.id}`, true, false);
			constraintSet.push(model.smallerThan(0).addTerm(1, y1).addTerm(1, h1).addTerm(-1, y2).addTerm(-MHeight, a2));

			// ... on the right of element 2
			const a3 = model.addVariable(0, `${element1.id}_onRight_${element2.id}`, true, false);
			constraintSet.push(model.smallerThan(0).addTerm(1, x2).addTerm(1, w2).addTerm(-1, x1).addTerm(-MWidth, a3));

			// ... below element 2
			const a4 = model.addVariable(0, `${element1.id}_below_${element2.id}`, true, false);
			constraintSet.push(model.smallerThan(0).addTerm(1, y2).addTerm(1, h2).addTerm(-1, y1).addTerm(-MHeight, a4));

			const equality = model.equal(3).addTerm(1, a1).addTerm(1, a2).addTerm(1, a3).addTerm(1, a4);

			return constraintSet;
		}


		function respectRightSide(model, element, displayWidth, offset){
			return [model.smallerThan(displayWidth-offset).addTerm(1, element.x).addTerm(1, element.w)];
		}


		function setConstraintSetPriority(constraintSet, priority){
            for (const constraint of constraintSet) {
                constraint.relax(1,priority);
            }
        }





		const displayWidth = 500;
		const displayheight = 728;

		// Setting up solver
		const Model = solver.Model;
		const model = new Model(1e-8, "model").minimize();

		nUIElements = 0;

		// Creating UI elements
		const elt1 = new UIElement(model);
		setMinW(model, elt1, 100);
		setMaxW(model, elt1, 200);
		setMinH(model, elt1, 200);
		setMaxH(model, elt1, 200);

		setMinX(model, elt1, 100);
		setMaxX(model, elt1, 200);
		setMinY(model, elt1, 300);
		setMaxY(model, elt1, 300);


		const elt2 = new UIElement(model);
		setMinW(model, elt2, 200);
		setMaxW(model, elt2, 300);
		setMinH(model, elt2, 50);
		setMaxH(model, elt2, 50);

		setMinX(model, elt2, 150);
		setMaxX(model, elt2, 400);
		setMinY(model, elt2, 400);
		setMaxY(model, elt2, 400);


		respectRightSide(model, elt2, displayWidth, 50);

		const cstSet = noOverlap(model, elt1, elt2);

		setConstraintSetPriority(cstSet,1);

		if (model.tableauInitialized === false) {
			model.tableau.setModel(model);
			model.tableauInitialized = true;
		}

		const solution = model.solve();
		assert.deepEqual(elt1.x.value, 100);
		assert.deepEqual(elt1.y.value, 300);
		assert.deepEqual(elt1.w.value, 150);
		assert.deepEqual(elt1.h.value, 200);
		assert.deepEqual(elt2.x.value, 250);
		assert.deepEqual(elt2.y.value, 400);
		assert.deepEqual(elt2.w.value, 200);
		assert.deepEqual(elt2.h.value, 50);
		assert.deepEqual(solution.iter !== undefined, true);
	});
});
