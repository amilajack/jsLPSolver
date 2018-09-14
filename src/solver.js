/* eslint no-underscore-dangle: off, no-param-reassign: off */
import Tableau_ from './Tableau/Tableau';
// import branchAndCut from './Tableau/branchAndCut';
import expressions from './expressions';

// If the user is giving us an array
// or a string, convert it to a JSON Model
// otherwise, spit it out as a string
// if(model.length){
//     return toJSON(model);
// } else {
//     return fromJSON(model);
// }

import TableauSolution from './Tableau/Solution';

import MilpSolution_ from './Tableau/MilpSolution';

import './Tableau/simplex';

import './Tableau/cuttingStrategies';
import './Tableau/dynamicModification';
import './Tableau/log';
import './Tableau/backup';
import './Tableau/branchingStrategies';
import './Tableau/integerProperties';

//-------------------------------------------------------------------
// SimplexJS
// https://github.com/
// An Object-Oriented Linear Programming Solver
//
// By Justin Wolcott (c)
// Licensed under the MIT License.
//-------------------------------------------------------------------

import Tableau from './Tableau';

// import Model from './Model';
import validation from './Validation';

const { SlackVariable: SlackVariable_ } = expressions;

var Constraint = expressions.Constraint;
var Equality = expressions.Equality;
var Variable = expressions.Variable;
var IntegerVariable = expressions.IntegerVariable;
var Term = expressions.Term;

/** ***********************************************************
 * Class: Model
 * Description: Holds the model of a linear optimisation problem
 ************************************************************* */
class Model {
  constructor(precision, name) {
    this.tableau = new Tableau_(precision);

    this.name = name;

    this.variables = [];

    this.integerVariables = [];

    this.unrestrictedVariables = {};

    this.constraints = [];

    this.nConstraints = 0;

    this.nVariables = 0;

    this.isMinimization = true;

    this.tableauInitialized = false;
    this.relaxationIndex = 1;

    this.useMIRCuts = true;

    this.checkForCycles = false;
  }

  minimize() {
    this.isMinimization = true;
    return this;
  }

  maximize() {
    this.isMinimization = false;
    return this;
  }

  // Model.prototype.addConstraint = function (constraint) {
  //     // TODO: make sure that the constraint does not belong do another model
  //     // and make
  //     this.constraints.push(constraint);
  //     return this;
  // };

  _getNewElementIndex() {
    if (this.availableIndexes.length > 0) {
      return this.availableIndexes.pop();
    }

    const index = this.lastElementIndex;
    this.lastElementIndex += 1;
    return index;
  }

  _addConstraint(constraint) {
    const slackVariable = constraint.slack;
    this.tableau.variablesPerIndex[slackVariable.index] = slackVariable;
    this.constraints.push(constraint);
    this.nConstraints += 1;
    if (this.tableauInitialized === true) {
      this.tableau.addConstraint(constraint);
    }
  }

  smallerThan(rhs) {
    const constraint = new Constraint(
      rhs,
      true,
      this.tableau.getNewElementIndex(),
      this
    );
    this._addConstraint(constraint);
    return constraint;
  }

  greaterThan(rhs) {
    const constraint = new Constraint(
      rhs,
      false,
      this.tableau.getNewElementIndex(),
      this
    );
    this._addConstraint(constraint);
    return constraint;
  }

  equal(rhs) {
    const constraintUpper = new Constraint(
      rhs,
      true,
      this.tableau.getNewElementIndex(),
      this
    );
    this._addConstraint(constraintUpper);

    const constraintLower = new Constraint(
      rhs,
      false,
      this.tableau.getNewElementIndex(),
      this
    );
    this._addConstraint(constraintLower);

    return new Equality(constraintUpper, constraintLower);
  }

  addVariable(cost, id, isInteger, isUnrestricted, priority) {
    if (typeof priority === 'string') {
      switch (priority) {
        case 'required':
          priority = 0;
          break;
        case 'strong':
          priority = 1;
          break;
        case 'medium':
          priority = 2;
          break;
        case 'weak':
          priority = 3;
          break;
        default:
          priority = 0;
          break;
      }
    }

    const varIndex = this.tableau.getNewElementIndex();
    if (id === null || id === undefined) {
      id = `v${varIndex}`;
    }

    if (cost === null || cost === undefined) {
      cost = 0;
    }

    if (priority === null || priority === undefined) {
      priority = 0;
    }

    let variable;
    if (isInteger) {
      variable = new IntegerVariable(id, cost, varIndex, priority);
      this.integerVariables.push(variable);
    } else {
      variable = new Variable(id, cost, varIndex, priority);
    }

    this.variables.push(variable);
    this.tableau.variablesPerIndex[varIndex] = variable;

    if (isUnrestricted) {
      this.unrestrictedVariables[varIndex] = true;
    }

    this.nVariables += 1;

    if (this.tableauInitialized === true) {
      this.tableau.addVariable(variable);
    }

    return variable;
  }

  _removeConstraint(constraint) {
    const idx = this.constraints.indexOf(constraint);
    if (idx === -1) {
      console.warn('[Model.removeConstraint] Constraint not present in model');
      return;
    }

    this.constraints.splice(idx, 1);
    this.nConstraints -= 1;

    if (this.tableauInitialized === true) {
      this.tableau.removeConstraint(constraint);
    }

    if (constraint.relaxation) {
      this.removeVariable(constraint.relaxation);
    }
  }

  //-------------------------------------------------------------------
  // For dynamic model modification
  //-------------------------------------------------------------------
  removeConstraint(constraint) {
    if (constraint.isEquality) {
      this._removeConstraint(constraint.upperBound);
      this._removeConstraint(constraint.lowerBound);
    } else {
      this._removeConstraint(constraint);
    }

    return this;
  }

  removeVariable(variable) {
    const idx = this.variables.indexOf(variable);
    if (idx === -1) {
      console.warn('[Model.removeVariable] Variable not present in model');
      return;
    }
    this.variables.splice(idx, 1);

    if (this.tableauInitialized === true) {
      this.tableau.removeVariable(variable);
    }

    return this;
  }

  updateRightHandSide(constraint, difference) {
    if (this.tableauInitialized === true) {
      this.tableau.updateRightHandSide(constraint, difference);
    }
    return this;
  }

  updateConstraintCoefficient(constraint, variable, difference) {
    if (this.tableauInitialized === true) {
      this.tableau.updateConstraintCoefficient(
        constraint,
        variable,
        difference
      );
    }
    return this;
  }

  setCost(cost, variable) {
    let difference = cost - variable.cost;
    if (this.isMinimization === false) {
      difference = -difference;
    }

    variable.cost = cost;
    this.tableau.updateCost(variable, difference);
    return this;
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  loadJson(jsonModel) {
    this.isMinimization = jsonModel.opType !== 'max';

    const variables = jsonModel.variables;
    const constraints = jsonModel.constraints;

    const constraintsMin = {};
    const constraintsMax = {};

    // Instantiating constraints
    const constraintIds = Object.keys(constraints);
    const nConstraintIds = constraintIds.length;

    for (var c = 0; c < nConstraintIds; c += 1) {
      const constraintId = constraintIds[c];
      const constraint = constraints[constraintId];
      const { equal } = constraint;

      const { weight } = constraint;
      const priority = constraint.priority;
      const relaxed = weight !== undefined || priority !== undefined;

      let lowerBound;
      let upperBound;
      if (equal === undefined) {
        const min = constraint.min;
        if (min !== undefined) {
          lowerBound = this.greaterThan(min);
          constraintsMin[constraintId] = lowerBound;
          if (relaxed) {
            lowerBound.relax(weight, priority);
          }
        }

        const { max } = constraint;
        if (max !== undefined) {
          upperBound = this.smallerThan(max);
          constraintsMax[constraintId] = upperBound;
          if (relaxed) {
            upperBound.relax(weight, priority);
          }
        }
      } else {
        lowerBound = this.greaterThan(equal);
        constraintsMin[constraintId] = lowerBound;

        upperBound = this.smallerThan(equal);
        constraintsMax[constraintId] = upperBound;

        const equality = new Equality(lowerBound, upperBound);
        if (relaxed) {
          equality.relax(weight, priority);
        }
      }
    }

    const variableIds = Object.keys(variables);
    const nVariables = variableIds.length;

    const integerVarIds = jsonModel.ints || {};
    const binaryVarIds = jsonModel.binaries || {};
    const unrestrictedVarIds = jsonModel.unrestricted || {};

    // Instantiating variables and constraint terms
    const objectiveName = jsonModel.optimize;
    for (let v = 0; v < nVariables; v += 1) {
      // Creation of the variables
      const variableId = variableIds[v];
      const variableConstraints = variables[variableId];
      const cost = variableConstraints[objectiveName] || 0;
      const isBinary = !!binaryVarIds[variableId];
      const isInteger = !!integerVarIds[variableId] || isBinary;
      const isUnrestricted = !!unrestrictedVarIds[variableId];
      const variable = this.addVariable(
        cost,
        variableId,
        isInteger,
        isUnrestricted
      );

      if (isBinary) {
        // Creating an upperbound constraint for this variable
        this.smallerThan(1).addTerm(1, variable);
      }

      const constraintNames = Object.keys(variableConstraints);
      for (c = 0; c < constraintNames.length; c += 1) {
        const constraintName = constraintNames[c];
        if (constraintName === objectiveName) {
          continue;
        }

        const coefficient = variableConstraints[constraintName];

        const constraintMin = constraintsMin[constraintName];
        if (constraintMin !== undefined) {
          constraintMin.addTerm(coefficient, variable);
        }

        const constraintMax = constraintsMax[constraintName];
        if (constraintMax !== undefined) {
          constraintMax.addTerm(coefficient, variable);
        }
      }
    }

    return this;
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  getNumberOfIntegerVariables() {
    return this.integerVariables.length;
  }

  solve() {
    // Setting tableau if not done
    if (this.tableauInitialized === false) {
      this.tableau.setModel(this);
      this.tableauInitialized = true;
    }

    return this.tableau.solve();
  }

  isFeasible() {
    return this.tableau.feasible;
  }

  save() {
    return this.tableau.save();
  }

  restore() {
    return this.tableau.restore();
  }

  activateMIRCuts(useMIRCuts) {
    this.useMIRCuts = useMIRCuts;
  }

  debug(debugCheckForCycles) {
    this.checkForCycles = debugCheckForCycles;
  }

  log(message) {
    return this.tableau.log(message);
  }
}

/** *************************************************************
 * Method: polyopt
 * Scope: private
 * Agruments:
 *        model: The model we want solver to operate on.
                 Because we're in here, we're assuming that
                 we're solving a multi-objective optimization
                 problem. Poly-Optimization. polyopt.

                 This model has to be formed a little differently
                 because it has multiple objective functions.
                 Normally, a model has 2 attributes: opType (string,
                 "max" or "min"), and optimize (string, whatever
                 attribute we're optimizing.

                 Now, there is no opType attribute on the model,
                 and optimize is an object of attributes to be
                 optimized, and how they're to be optimized.
                 For example:

                 ...
                 "optimize": {
                    "pancakes": "max",
                    "cost": "minimize"
                 }
                 ...


 ************************************************************* */

function foo() {
  // I have no idea if this is actually works, or what,
  // but here is my algorithm to solve linear programs
  // with multiple objective functions

  // 1. Optimize for each constraint
  // 2. The results for each solution is a vector
  //    representing a vertex on the polytope we're creating
  // 3. The results for all solutions describes the shape
  //    of the polytope (would be nice to have the equation
  //    representing this)
  // 4. Find the mid-point between all vertices by doing the
  //    following (a_1 + a_2 ... a_n) / n;
  const objectives = model.optimize;

  const newConstraints = JSON.parse(JSON.stringify(model.optimize));

  const keys = Object.keys(model.optimize);

  let tmp;

  let counter = 0;

  const vectors = {};

  let vectorKey = '';

  const obj = {};

  const pareto = [];

  let i;
  let j;
  let x;
  let y;
  let z;

  // Delete the optimize object from the model
  delete model.optimize;

  // Iterate and Clear
  for (i = 0; i < keys.length; i++) {
    // Clean up the newConstraints
    newConstraints[keys[i]] = 0;
  }

  // Solve and add
  for (i = 0; i < keys.length; i++) {
    // Prep the model
    model.optimize = keys[i];
    model.opType = objectives[keys[i]];

    // solve the model
    tmp = solver.Solve(model, undefined, undefined, true);

    // Only the variables make it into the solution;
    // not the attributes.
    //
    // Because of this, we have to add the attributes
    // back onto the solution so we can do math with
    // them later...

    // Loop over the keys
    for (y in keys) {
      // We're only worried about attributes, not variables
      if (!model.variables[keys[y]]) {
        // Create space for the attribute in the tmp object
        tmp[keys[y]] = tmp[keys[y]] ? tmp[keys[y]] : 0;
        // Go over each of the variables
        for (x in model.variables) {
          // Does the variable exist in tmp *and* does attribute exist in this model?
          if (model.variables[x][keys[y]] && tmp[x]) {
            // Add it to tmp
            tmp[keys[y]] += tmp[x] * model.variables[x][keys[y]];
          }
        }
      }
    }

    // clear our key
    vectorKey = 'base';
    // this makes sure that if we get
    // the same vector more than once,
    // we only count it once when finding
    // the midpoint
    for (j = 0; j < keys.length; j++) {
      if (tmp[keys[j]]) {
        vectorKey += `-${((tmp[keys[j]] * 1000) | 0) / 1000}`;
      } else {
        vectorKey += '-0';
      }
    }

    // Check here to ensure it doesn't exist
    if (!vectors[vectorKey]) {
      // Add the vector-key in
      vectors[vectorKey] = 1;
      counter++;

      // Iterate over the keys
      // and update our new constraints
      for (j = 0; j < keys.length; j++) {
        if (tmp[keys[j]]) {
          newConstraints[keys[j]] += tmp[keys[j]];
        }
      }

      // Push the solution into the paretos
      // array after cleaning it of some
      // excess data markers

      delete tmp.feasible;
      delete tmp.result;
      pareto.push(tmp);
    }
  }

  // Trying to find the mid-point
  // divide each constraint by the
  // number of constraints
  // *midpoint formula*
  // (x1 + x2 + x3) / 3
  for (i = 0; i < keys.length; i++) {
    model.constraints[keys[i]] = { equal: newConstraints[keys[i]] / counter };
  }

  // Give the model a fake thing to optimize on
  model.optimize = `cheater-${Math.random()}`;
  model.opType = 'max';

  // And add the fake attribute to the variables
  // in the model
  for (i in model.variables) {
    model.variables[i].cheater = 1;
  }

  // Build out the object with all attributes
  for (i in pareto) {
    for (x in pareto[i]) {
      obj[x] = obj[x] || { min: 1e99, max: -1e99 };
    }
  }

  // Give each pareto a full attribute list
  // while getting the max and min values
  // for each attribute
  for (i in obj) {
    for (x in pareto) {
      if (pareto[x][i]) {
        if (pareto[x][i] > obj[i].max) {
          obj[i].max = pareto[x][i];
        }
        if (pareto[x][i] < obj[i].min) {
          obj[i].min = pareto[x][i];
        }
      } else {
        pareto[x][i] = 0;
        obj[i].min = 0;
      }
    }
  }
  // Solve the model for the midpoints
  tmp = solver.Solve(model, undefined, undefined, true);

  return {
    midpoint: tmp,
    vertices: pareto,
    ranges: obj
  };
}

/** ***********************************************************
 * Method: toJSON
 * Scope: Public:
 * Agruments: input: Whatever the user gives us
 * Purpose: Convert an unfriendly formatted LP
 *          into something that our library can
 *          work with
 ************************************************************* */
export function toJSON(input) {
  const rxo = {
    /* jshint ignore:start */
    is_blank: /^\W{0,}$/,
    is_objective: /(max|min)(imize){0,}\:/i,
    // previous version
    // "is_int": /^\W{0,}int/i,
    // new version to avoid comments
    is_int: /^(?!\/\*)\W{0,}int/i,
    is_constraint: /(\>|\<){0,}\=/i,
    is_unrestricted: /^\S{0,}unrestricted/i,
    parse_lhs: /(\-|\+){0,1}\s{0,1}\d{0,}\.{0,}\d{0,}\s{0,}[A-Za-z]\S{0,}/gi,
    parse_rhs: /(\-|\+){0,1}\d{1,}\.{0,}\d{0,}\W{0,}\;{0,1}$/i,
    parse_dir: /(\>|\<){0,}\=/gi,
    parse_int: /[^\s|^\,]+/gi,
    get_num: /(\-|\+){0,1}(\W|^)\d+\.{0,1}\d{0,}/g, // Why accepting character \W before the first digit?
    get_word: /[A-Za-z].*/
    /* jshint ignore:end */
  };

  const model = {
    opType: '',
    optimize: '_obj',
    constraints: {},
    variables: {}
  };

  const constraints = {
    '>=': 'min',
    '<=': 'max',
    '=': 'equal'
  };

  let tmp = '';
  let ary = null;
  let hldr = '';
  let hldr2 = '';

  let constraint = '';
  let rhs = 0;

  // Handle input if its coming
  // to us as a hard string
  // instead of as an array of
  // strings
  if (typeof input === 'string') {
    input = input.split('\n');
  }

  // Start iterating over the rows
  // to see what all we have
  for (let i = 0; i < input.length; i++) {
    constraint = `__${i}`;

    // Get the string we're working with
    tmp = input[i];

    // Set the test = 0
    tst = 0;

    // Reset the array
    ary = null;

    // Test to see if we're the objective
    if (rxo.is_objective.test(tmp)) {
      // Set up in model the opType
      model.opType = tmp.match(/(max|min)/gi)[0];

      // Pull apart lhs
      ary = tmp
        .match(rxo.parse_lhs)
        .map(d => d.replace(/\s+/, ''))
        .slice(1);

      // *** STEP 1 *** ///
      // Get the variables out
      ary.forEach((d) => {
        // Get the number if its there
        hldr = d.match(rxo.get_num);

        // If it isn't a number, it might
        // be a standalone variable
        if (hldr === null) {
          if (d.substr(0, 1) === '-') {
            hldr = -1;
          } else {
            hldr = 1;
          }
        } else {
          hldr = hldr[0];
        }

        hldr = parseFloat(hldr);

        // Get the variable type
        hldr2 = d.match(rxo.get_word)[0].replace(/\;$/, '');

        // Make sure the variable is in the model
        model.variables[hldr2] = model.variables[hldr2] || {};
        model.variables[hldr2]._obj = hldr;
      });
      // //////////////////////////////////
    } else if (rxo.is_int.test(tmp)) {
      // Get the array of ints
      ary = tmp.match(rxo.parse_int).slice(1);

      // Since we have an int, our model should too
      model.ints = model.ints || {};

      ary.forEach((d) => {
        d = d.replace(';', '');
        model.ints[d] = 1;
      });
      // //////////////////////////////////
    } else if (rxo.is_constraint.test(tmp)) {
      const separatorIndex = tmp.indexOf(':');
      const constraintExpression = separatorIndex === -1 ? tmp : tmp.slice(separatorIndex + 1);

      // Pull apart lhs
      ary = constraintExpression
        .match(rxo.parse_lhs)
        .map(d => d.replace(/\s+/, ''));

      // *** STEP 1 *** ///
      // Get the variables out
      ary.forEach((d) => {
        // Get the number if its there
        hldr = d.match(rxo.get_num);

        if (hldr === null) {
          if (d.substr(0, 1) === '-') {
            hldr = -1;
          } else {
            hldr = 1;
          }
        } else {
          hldr = hldr[0];
        }

        hldr = parseFloat(hldr);

        // Get the variable name
        hldr2 = d.match(rxo.get_word)[0];

        // Make sure the variable is in the model
        model.variables[hldr2] = model.variables[hldr2] || {};
        model.variables[hldr2][constraint] = hldr;
      });

      // *** STEP 2 *** ///
      // Get the RHS out
      rhs = parseFloat(tmp.match(rxo.parse_rhs)[0]);

      // *** STEP 3 *** ///
      // Get the Constrainer out
      tmp = constraints[tmp.match(rxo.parse_dir)[0]];
      model.constraints[constraint] = model.constraints[constraint] || {};
      model.constraints[constraint][tmp] = rhs;
      // //////////////////////////////////
    } else if (rxo.is_unrestricted.test(tmp)) {
      // Get the array of unrestricted
      ary = tmp.match(rxo.parse_int).slice(1);

      // Since we have an int, our model should too
      model.unrestricted = model.unrestricted || {};

      ary.forEach((d) => {
        d = d.replace(';', '');
        model.unrestricted[d] = 1;
      });
    }
  }
  return model;
}

/** ***********************************************************
 * Method: fromJSON
 * Scope: Public:
 * Agruments: model: The model we want solver to operate on
 * Purpose: Convert a friendly JSON model into a model for a
 *          real solving library...in this case
 *          lp_solver
 ************************************************************* */
export function fromJSON(model) {
  // Make sure we at least have a model
  if (!model) {
    throw new Error('Solver requires a model to operate on');
  }

  let output = '';

  const lookup = {
    max: '<=',
    min: '>=',
    equal: '='
  };

  const rxClean = new RegExp('[^A-Za-z0-9]+', 'gi');

  // Build the objective statement
  output += `${model.opType}:`;

  // Iterate over the variables
  for (var x in model.variables) {
    // Give each variable a self of 1 unless
    // it exists already
    model.variables[x][x] = model.variables[x][x] ? model.variables[x][x] : 1;

    // Does our objective exist here?
    if (model.variables[x][model.optimize]) {
      output += ` ${model.variables[x][model.optimize]} ${x.replace(
        rxClean,
        '_'
      )}`;
    }
  }

  // Add some closure to our line thing
  output += ';\n';

  // And now... to iterate over the constraints
  for (x in model.constraints) {
    for (const y in model.constraints[x]) {
      for (const z in model.variables) {
        // Does our Constraint exist here?
        if (model.variables[z][x]) {
          output += ` ${model.variables[z][x]} ${z.replace(rxClean, '_')}`;
        }
      }
      // Add the constraint type and value...
      output += ` ${lookup[y]} ${model.constraints[x][y]}`;
      output += ';\n';
    }
  }

  // Are there any ints?
  if (model.ints) {
    output += '\n\n';
    for (x in model.ints) {
      output += `int ${x.replace(rxClean, '_')};\n`;
    }
  }

  // Are there any unrestricted?
  if (model.unrestricted) {
    output += '\n\n';
    for (x in model.unrestricted) {
      output += `unrestricted ${x.replace(rxClean, '_')};\n`;
    }
  }

  // And kick the string back
  return output;
}

export class MilpSolution extends TableauSolution {
  constructor(tableau, evaluation, feasible, bounded, branchAndCutIterations) {
    super(tableau, evaluation, feasible, bounded);
    this.iter = branchAndCutIterations;
  }
}

class Solution {
  constructor(tableau, evaluation, feasible, bounded) {
    this.feasible = feasible;
    this.evaluation = evaluation;
    this.bounded = bounded;
    this._tableau = tableau;
  }

  generateSolutionSet() {
    const solutionSet = {};

    const tableau = this._tableau;
    const varIndexByRow = tableau.varIndexByRow;
    const variablesPerIndex = tableau.variablesPerIndex;
    const matrix = tableau.matrix;
    const rhsColumn = tableau.rhsColumn;
    const lastRow = tableau.height - 1;
    const roundingCoeff = Math.round(1 / tableau.precision);

    for (let r = 1; r <= lastRow; r += 1) {
      const varIndex = varIndexByRow[r];
      const variable = variablesPerIndex[varIndex];
      if (variable === undefined || variable.isSlack === true) {
        continue;
      }

      const varValue = matrix[r][rhsColumn];
      solutionSet[variable.id] = Math.round(varValue * roundingCoeff) / roundingCoeff;
    }

    return solutionSet;
  }
}

/** ***********************************************************
 * Class: Tableau
 * Description: Simplex tableau, holding a the tableau matrix
 *              and all the information necessary to perform
 *              the simplex algorithm
 * Agruments:
 *        precision: If we're solving a MILP, how tight
 *                   do we want to define an integer, given
 *                   that 20.000000000000001 is not an integer.
 *                   (defaults to 1e-8)
 ************************************************************* */
class Tableau {
  constructor(precision) {
    this.model = null;

    this.matrix = null;
    this.width = 0;
    this.height = 0;

    this.costRowIndex = 0;
    this.rhsColumn = 0;

    this.variablesPerIndex = [];
    this.unrestrictedVars = null;

    // Solution attributes
    this.feasible = true; // until proven guilty
    this.evaluation = 0;

    this.varIndexByRow = null;
    this.varIndexByCol = null;

    this.rowByVarIndex = null;
    this.colByVarIndex = null;

    this.precision = precision || 1e-8;

    this.optionalObjectives = [];
    this.objectivesByPriority = {};

    this.savedState = null;

    this.availableIndexes = [];
    this.lastElementIndex = 0;

    this.variables = null;
    this.nVars = 0;

    this.bounded = true;
    this.unboundedVarIndex = null;

    this.branchAndCutIterations = 0;
  }

  solve() {
    if (this.model.getNumberOfIntegerVariables() > 0) {
      this.branchAndCut();
    } else {
      this.simplex();
    }
    this.updateVariableValues();
    return this.getSolution();
  }

  setOptionalObjective(priority, column, cost) {
    let objectiveForPriority = this.objectivesByPriority[priority];
    if (objectiveForPriority === undefined) {
      const nColumns = Math.max(this.width, column + 1);
      objectiveForPriority = new OptionalObjective(priority, nColumns);
      this.objectivesByPriority[priority] = objectiveForPriority;
      this.optionalObjectives.push(objectiveForPriority);
      this.optionalObjectives.sort((a, b) => a.priority - b.priority);
    }

    objectiveForPriority.reducedCosts[column] = cost;
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  initialize(width, height, variables, unrestrictedVars) {
    this.variables = variables;
    this.unrestrictedVars = unrestrictedVars;

    this.width = width;
    this.height = height;

    // BUILD AN EMPTY ARRAY OF THAT WIDTH
    const tmpRow = new Array(width);
    for (let i = 0; i < width; i++) {
      tmpRow[i] = 0;
    }

    // BUILD AN EMPTY TABLEAU
    this.matrix = new Array(height);
    for (let j = 0; j < height; j++) {
      this.matrix[j] = tmpRow.slice();
    }

    this.varIndexByRow = new Array(this.height);
    this.varIndexByCol = new Array(this.width);

    this.varIndexByRow[0] = -1;
    this.varIndexByCol[0] = -1;

    this.nVars = width + height - 2;
    this.rowByVarIndex = new Array(this.nVars);
    this.colByVarIndex = new Array(this.nVars);

    this.lastElementIndex = this.nVars;
  }

  _resetMatrix() {
    const variables = this.model.variables;
    const constraints = this.model.constraints;

    const nVars = variables.length;
    const nConstraints = constraints.length;

    let v;
    let varIndex;
    const costRow = this.matrix[0];
    const coeff = this.model.isMinimization === true ? -1 : 1;
    for (v = 0; v < nVars; v += 1) {
      const variable = variables[v];
      const priority = variable.priority;
      const cost = coeff * variable.cost;
      if (priority === 0) {
        costRow[v + 1] = cost;
      } else {
        this.setOptionalObjective(priority, v + 1, cost);
      }

      varIndex = variables[v].index;
      this.rowByVarIndex[varIndex] = -1;
      this.colByVarIndex[varIndex] = v + 1;
      this.varIndexByCol[v + 1] = varIndex;
    }

    let rowIndex = 1;
    for (let c = 0; c < nConstraints; c += 1) {
      const constraint = constraints[c];

      const constraintIndex = constraint.index;
      this.rowByVarIndex[constraintIndex] = rowIndex;
      this.colByVarIndex[constraintIndex] = -1;
      this.varIndexByRow[rowIndex] = constraintIndex;

      let t;
      let term;
      let column;
      const terms = constraint.terms;
      const nTerms = terms.length;
      const row = this.matrix[rowIndex++];
      if (constraint.isUpperBound) {
        for (t = 0; t < nTerms; t += 1) {
          term = terms[t];
          column = this.colByVarIndex[term.variable.index];
          row[column] = term.coefficient;
        }

        row[0] = constraint.rhs;
      } else {
        for (t = 0; t < nTerms; t += 1) {
          term = terms[t];
          column = this.colByVarIndex[term.variable.index];
          row[column] = -term.coefficient;
        }

        row[0] = -constraint.rhs;
      }
    }
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  setModel(model) {
    this.model = model;

    const width = model.nVariables + 1;
    const height = model.nConstraints + 1;

    this.initialize(
      width,
      height,
      model.variables,
      model.unrestrictedVariables
    );
    this._resetMatrix();
    return this;
  }

  getNewElementIndex() {
    if (this.availableIndexes.length > 0) {
      return this.availableIndexes.pop();
    }

    const index = this.lastElementIndex;
    this.lastElementIndex += 1;
    return index;
  }

  density() {
    let density = 0;

    const matrix = this.matrix;
    for (let r = 0; r < this.height; r++) {
      const row = matrix[r];
      for (let c = 0; c < this.width; c++) {
        if (row[c] !== 0) {
          density += 1;
        }
      }
    }

    return density / (this.height * this.width);
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  setEvaluation() {
    // Rounding objective value
    const roundingCoeff = Math.round(1 / this.precision);
    const evaluation = this.matrix[this.costRowIndex][this.rhsColumn];
    this.evaluation = Math.round(evaluation * roundingCoeff) / roundingCoeff;
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  getSolution() {
    const evaluation = this.model.isMinimization === true ? this.evaluation : -this.evaluation;

    if (this.model.getNumberOfIntegerVariables() > 0) {
      return new MilpSolution_(
        this,
        evaluation,
        this.feasible,
        this.bounded,
        this.branchAndCutIterations
      );
    }
    return new Solution(this, evaluation, this.feasible, this.bounded);
  }

  copy() {
    const copy = new Tableau(this.precision);

    copy.width = this.width;
    copy.height = this.height;

    copy.nVars = this.nVars;
    copy.model = this.model;

    // Making a shallow copy of integer variable indexes
    // and variable ids
    copy.variables = this.variables;
    copy.variablesPerIndex = this.variablesPerIndex;
    copy.unrestrictedVars = this.unrestrictedVars;
    copy.lastElementIndex = this.lastElementIndex;

    // All the other arrays are deep copied
    copy.varIndexByRow = this.varIndexByRow.slice();
    copy.varIndexByCol = this.varIndexByCol.slice();

    copy.rowByVarIndex = this.rowByVarIndex.slice();
    copy.colByVarIndex = this.colByVarIndex.slice();

    copy.availableIndexes = this.availableIndexes.slice();

    const optionalObjectivesCopy = [];
    for (let o = 0; o < this.optionalObjectives.length; o++) {
      optionalObjectivesCopy[o] = this.optionalObjectives[o].copy();
    }
    copy.optionalObjectives = optionalObjectivesCopy;

    const matrix = this.matrix;
    const matrixCopy = new Array(this.height);
    for (let r = 0; r < this.height; r++) {
      matrixCopy[r] = matrix[r].slice();
    }

    copy.matrix = matrixCopy;

    return copy;
  }

  save() {
    this.savedState = this.copy();
  }

  restore() {
    if (this.savedState === null) {
      return;
    }

    const save = this.savedState;
    const savedMatrix = save.matrix;
    this.nVars = save.nVars;
    this.model = save.model;

    // Shallow restore
    this.variables = save.variables;
    this.variablesPerIndex = save.variablesPerIndex;
    this.unrestrictedVars = save.unrestrictedVars;
    this.lastElementIndex = save.lastElementIndex;

    this.width = save.width;
    this.height = save.height;

    // Restoring matrix
    let r;
    let c;
    for (r = 0; r < this.height; r += 1) {
      const savedRow = savedMatrix[r];
      const row = this.matrix[r];
      for (c = 0; c < this.width; c += 1) {
        row[c] = savedRow[c];
      }
    }

    // Restoring all the other structures
    const savedBasicIndexes = save.varIndexByRow;
    for (c = 0; c < this.height; c += 1) {
      this.varIndexByRow[c] = savedBasicIndexes[c];
    }

    while (this.varIndexByRow.length > this.height) {
      this.varIndexByRow.pop();
    }

    const savedNonBasicIndexes = save.varIndexByCol;
    for (r = 0; r < this.width; r += 1) {
      this.varIndexByCol[r] = savedNonBasicIndexes[r];
    }

    while (this.varIndexByCol.length > this.width) {
      this.varIndexByCol.pop();
    }

    const savedRows = save.rowByVarIndex;
    const savedCols = save.colByVarIndex;
    for (let v = 0; v < this.nVars; v += 1) {
      this.rowByVarIndex[v] = savedRows[v];
      this.colByVarIndex[v] = savedCols[v];
    }

    if (
      save.optionalObjectives.length > 0
      && this.optionalObjectives.length > 0
    ) {
      this.optionalObjectives = [];
      this.optionalObjectivePerPriority = {};
      for (let o = 0; o < save.optionalObjectives.length; o++) {
        const optionalObjectiveCopy = save.optionalObjectives[o].copy();
        this.optionalObjectives[o] = optionalObjectiveCopy;
        this.optionalObjectivePerPriority[
          optionalObjectiveCopy.priority
        ] = optionalObjectiveCopy;
      }
    }
  }

  //-------------------------------------------------------------------
  // Applying cuts on a tableau and resolving
  //-------------------------------------------------------------------
  applyCuts(branchingCuts) {
    // Restoring initial solution
    this.restore();

    this.addCutConstraints(branchingCuts);
    this.simplex();
    // Adding MIR cuts
    if (this.model.useMIRCuts) {
      let fractionalVolumeImproved = true;
      while (fractionalVolumeImproved) {
        const fractionalVolumeBefore = this.computeFractionalVolume(true);
        this.applyMIRCuts();
        this.simplex();

        const fractionalVolumeAfter = this.computeFractionalVolume(true);

        // If the new fractional volume is bigger than 90% of the previous one
        // we assume there is no improvement from the MIR cuts
        if (fractionalVolumeAfter >= 0.9 * fractionalVolumeBefore) {
          fractionalVolumeImproved = false;
        }
      }
    }
  }

  //-------------------------------------------------------------------
  // Function: MILP
  // Detail: Main function, my attempt at a mixed integer linear programming
  //         solver
  //-------------------------------------------------------------------
  branchAndCut() {
    const branches = [];
    let iterations = 0;

    // This is the default result
    // If nothing is both *integral* and *feasible*
    let bestEvaluation = Infinity;
    let bestBranch = null;
    const bestOptionalObjectivesEvaluations = [];
    for (let oInit = 0; oInit < this.optionalObjectives.length; oInit += 1) {
      bestOptionalObjectivesEvaluations.push(Infinity);
    }

    // And here...we...go!

    // 1.) Load a model into the queue
    let branch = new Branch(-Infinity, []);
    branches.push(branch);

    // If all branches have been exhausted terminate the loop
    while (branches.length > 0) {
      // Get a model from the queue
      branch = branches.pop();
      if (branch.relaxedEvaluation > bestEvaluation) {
        continue;
      }

      // Solving from initial relaxed solution
      // with additional cut constraints

      // Adding cut constraints
      const cuts = branch.cuts;
      this.applyCuts(cuts);

      iterations++;
      if (this.feasible === false) {
        continue;
      }

      const evaluation = this.evaluation;
      if (evaluation > bestEvaluation) {
        // This branch does not contain the optimal solution
        continue;
      }

      // To deal with the optional objectives
      if (evaluation === bestEvaluation) {
        let isCurrentEvaluationWorse = true;
        for (let o = 0; o < this.optionalObjectives.length; o += 1) {
          if (
            this.optionalObjectives[o].reducedCosts[0]
            > bestOptionalObjectivesEvaluations[o]
          ) {
            break;
          } else if (
            this.optionalObjectives[o].reducedCosts[0]
            < bestOptionalObjectivesEvaluations[o]
          ) {
            isCurrentEvaluationWorse = false;
            break;
          }
        }

        if (isCurrentEvaluationWorse) {
          continue;
        }
      }

      // Is the model both integral and feasible?
      if (this.isIntegral() === true) {
        if (iterations === 1) {
          this.branchAndCutIterations = iterations;
          return;
        }
        // Store the solution as the bestSolution
        bestBranch = branch;
        bestEvaluation = evaluation;
        for (
          let oCopy = 0;
          oCopy < this.optionalObjectives.length;
          oCopy += 1
        ) {
          bestOptionalObjectivesEvaluations[oCopy] = this.optionalObjectives[
            oCopy
          ].reducedCosts[0];
        }
      } else {
        if (iterations === 1) {
          // Saving the first iteration
          // TODO: implement a better strategy for saving the tableau?
          this.save();
        }

        // If the solution is
        //  a. Feasible
        //  b. Better than the current solution
        //  c. but *NOT* integral

        // So the solution isn't integral? How do we solve this.
        // We create 2 new models, that are mirror images of the prior
        // model, with 1 exception.

        // Say we're trying to solve some stupid problem requiring you get
        // animals for your daughter's kindergarten petting zoo party
        // and you have to choose how many ducks, goats, and lambs to get.

        // Say that the optimal solution to this problem if we didn't have
        // to make it integral was {duck: 8, lambs: 3.5}
        //
        // To keep from traumatizing your daughter and the other children
        // you're going to want to have whole animals

        // What we would do is find the most fractional variable (lambs)
        // and create new models from the old models, but with a new constraint
        // on apples. The constraints on the low model would look like:
        // constraints: {...
        //   lamb: {max: 3}
        //   ...
        // }
        //
        // while the constraints on the high model would look like:
        //
        // constraints: {...
        //   lamb: {min: 4}
        //   ...
        // }
        // If neither of these models is feasible because of this constraint,
        // the model is not integral at this point, and fails.

        // Find out where we want to split the solution
        const variable = this.getMostFractionalVar();

        const varIndex = variable.index;

        const cutsHigh = [];
        const cutsLow = [];

        const nCuts = cuts.length;
        for (let c = 0; c < nCuts; c += 1) {
          const cut = cuts[c];
          if (cut.varIndex === varIndex) {
            if (cut.type === 'min') {
              cutsLow.push(cut);
            } else {
              cutsHigh.push(cut);
            }
          } else {
            cutsHigh.push(cut);
            cutsLow.push(cut);
          }
        }

        const min = Math.ceil(variable.value);
        const max = Math.floor(variable.value);

        const cutHigh = new Cut('min', varIndex, min);
        cutsHigh.push(cutHigh);

        const cutLow = new Cut('max', varIndex, max);
        cutsLow.push(cutLow);

        branches.push(new Branch(evaluation, cutsHigh));
        branches.push(new Branch(evaluation, cutsLow));

        // Sorting branches
        // Branches with the most promising lower bounds
        // will be picked first
        branches.sort(sortByEvaluation);
      }
    }

    // Adding cut constraints for the optimal solution
    if (bestBranch !== null) {
      // The model is feasible
      this.applyCuts(bestBranch.cuts);
    }
    this.branchAndCutIterations = iterations;
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  getMostFractionalVar() {
    let biggestFraction = 0;
    let selectedVarIndex = null;
    let selectedVarValue = null;
    const mid = 0.5;

    const integerVariables = this.model.integerVariables;
    const nIntegerVars = integerVariables.length;
    for (let v = 0; v < nIntegerVars; v++) {
      const varIndex = integerVariables[v].index;
      const varRow = this.rowByVarIndex[varIndex];
      if (varRow === -1) {
        continue;
      }

      const varValue = this.matrix[varRow][this.rhsColumn];
      const fraction = Math.abs(varValue - Math.round(varValue));
      if (biggestFraction < fraction) {
        biggestFraction = fraction;
        selectedVarIndex = varIndex;
        selectedVarValue = varValue;
      }
    }

    return new VariableData(selectedVarIndex, selectedVarValue);
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  getFractionalVarWithLowestCost() {
    let highestCost = Infinity;
    let selectedVarIndex = null;
    let selectedVarValue = null;

    const integerVariables = this.model.integerVariables;
    const nIntegerVars = integerVariables.length;
    for (let v = 0; v < nIntegerVars; v++) {
      const variable = integerVariables[v];
      const varIndex = variable.index;
      const varRow = this.rowByVarIndex[varIndex];
      if (varRow === -1) {
        // Variable value is non basic
        // its value is 0
        continue;
      }

      const varValue = this.matrix[varRow][this.rhsColumn];
      if (Math.abs(varValue - Math.round(varValue)) > this.precision) {
        const cost = variable.cost;
        if (highestCost > cost) {
          highestCost = cost;
          selectedVarIndex = varIndex;
          selectedVarValue = varValue;
        }
      }
    }

    return new VariableData(selectedVarIndex, selectedVarValue);
  }

  addCutConstraints(cutConstraints) {
    const nCutConstraints = cutConstraints.length;

    const height = this.height;
    const heightWithCuts = height + nCutConstraints;

    // Adding rows to hold cut constraints
    for (let h = height; h < heightWithCuts; h += 1) {
      if (this.matrix[h] === undefined) {
        this.matrix[h] = this.matrix[h - 1].slice();
      }
    }

    // Adding cut constraints
    this.height = heightWithCuts;
    this.nVars = this.width + this.height - 2;

    let c;
    const lastColumn = this.width - 1;
    for (let i = 0; i < nCutConstraints; i += 1) {
      const cut = cutConstraints[i];

      // Constraint row index
      const r = height + i;

      const sign = cut.type === 'min' ? -1 : 1;

      // Variable on which the cut is applied
      const varIndex = cut.varIndex;
      const varRowIndex = this.rowByVarIndex[varIndex];
      const constraintRow = this.matrix[r];
      if (varRowIndex === -1) {
        // Variable is non basic
        constraintRow[this.rhsColumn] = sign * cut.value;
        for (c = 1; c <= lastColumn; c += 1) {
          constraintRow[c] = 0;
        }
        constraintRow[this.colByVarIndex[varIndex]] = sign;
      } else {
        // Variable is basic
        const varRow = this.matrix[varRowIndex];
        const varValue = varRow[this.rhsColumn];
        constraintRow[this.rhsColumn] = sign * (cut.value - varValue);
        for (c = 1; c <= lastColumn; c += 1) {
          constraintRow[c] = -sign * varRow[c];
        }
      }

      // Creating slack variable
      const slackVarIndex = this.getNewElementIndex();
      this.varIndexByRow[r] = slackVarIndex;
      this.rowByVarIndex[slackVarIndex] = r;
      this.colByVarIndex[slackVarIndex] = -1;
      this.variablesPerIndex[slackVarIndex] = new SlackVariable_(
        `s${slackVarIndex}`,
        slackVarIndex
      );
      this.nVars += 1;
    }
  }

  _addLowerBoundMIRCut(rowIndex) {
    if (rowIndex === this.costRowIndex) {
      // console.log("! IN MIR CUTS : The index of the row corresponds to the cost row. !");
      return false;
    }

    const model = this.model;
    const matrix = this.matrix;

    const intVar = this.variablesPerIndex[this.varIndexByRow[rowIndex]];
    if (!intVar.isInteger) {
      return false;
    }

    const d = matrix[rowIndex][this.rhsColumn];
    const frac_d = d - Math.floor(d);

    if (frac_d < this.precision || 1 - this.precision < frac_d) {
      return false;
    }

    // Adding a row
    const r = this.height;
    matrix[r] = matrix[r - 1].slice();
    this.height += 1;

    // Creating slack variable
    this.nVars += 1;
    const slackVarIndex = this.getNewElementIndex();
    this.varIndexByRow[r] = slackVarIndex;
    this.rowByVarIndex[slackVarIndex] = r;
    this.colByVarIndex[slackVarIndex] = -1;
    this.variablesPerIndex[slackVarIndex] = new SlackVariable_(
      `s${slackVarIndex}`,
      slackVarIndex
    );

    matrix[r][this.rhsColumn] = Math.floor(d);

    for (
      let colIndex = 1;
      colIndex < this.varIndexByCol.length;
      colIndex += 1
    ) {
      const variable = this.variablesPerIndex[this.varIndexByCol[colIndex]];

      if (!variable.isInteger) {
        matrix[r][colIndex] = Math.min(
          0,
          matrix[rowIndex][colIndex] / (1 - frac_d)
        );
      } else {
        const coef = matrix[rowIndex][colIndex];
        const termCoeff = Math.floor(coef)
          + Math.max(0, coef - Math.floor(coef) - frac_d) / (1 - frac_d);
        matrix[r][colIndex] = termCoeff;
      }
    }

    for (let c = 0; c < this.width; c += 1) {
      matrix[r][c] -= matrix[rowIndex][c];
    }

    return true;
  }

  applyMIRCuts() {
    const nRows = this.height;
    for (let cst = 0; cst < nRows; cst += 1) {
      this._addLowerBoundMIRCut(cst);
    }
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  _putInBase(varIndex) {
    // Is varIndex in the base?
    let r = this.rowByVarIndex[varIndex];
    if (r === -1) {
      // Outside the base
      // pivoting to take it out
      const c = this.colByVarIndex[varIndex];

      // Selecting pivot row
      // (Any row with coefficient different from 0)
      for (let r1 = 1; r1 < this.height; r1 += 1) {
        const coefficient = this.matrix[r1][c];
        if (coefficient < -this.precision || this.precision < coefficient) {
          r = r1;
          break;
        }
      }

      this.pivot(r, c);
    }

    return r;
  }

  _takeOutOfBase(varIndex) {
    // Is varIndex in the base?
    let c = this.colByVarIndex[varIndex];
    if (c === -1) {
      // Inside the base
      // pivoting to take it out
      const r = this.rowByVarIndex[varIndex];

      // Selecting pivot column
      // (Any column with coefficient different from 0)
      const pivotRow = this.matrix[r];
      for (let c1 = 1; c1 < this.height; c1 += 1) {
        const coefficient = pivotRow[c1];
        if (coefficient < -this.precision || this.precision < coefficient) {
          c = c1;
          break;
        }
      }

      this.pivot(r, c);
    }

    return c;
  }

  updateVariableValues() {
    const nVars = this.variables.length;
    const roundingCoeff = Math.round(1 / this.precision);
    for (let v = 0; v < nVars; v += 1) {
      const variable = this.variables[v];
      const varIndex = variable.index;

      const r = this.rowByVarIndex[varIndex];
      if (r === -1) {
        // Variable is non basic
        variable.value = 0;
      } else {
        // Variable is basic
        const varValue = this.matrix[r][this.rhsColumn];
        variable.value = Math.round(varValue * roundingCoeff) / roundingCoeff;
      }
    }
  }

  updateRightHandSide(constraint, difference) {
    // Updates RHS of given constraint
    const lastRow = this.height - 1;
    const constraintRow = this.rowByVarIndex[constraint.index];
    if (constraintRow === -1) {
      // Slack is not in base
      const slackColumn = this.colByVarIndex[constraint.index];

      // Upading all the RHS values
      for (let r = 0; r <= lastRow; r += 1) {
        const row = this.matrix[r];
        row[this.rhsColumn] -= difference * row[slackColumn];
      }

      const nOptionalObjectives = this.optionalObjectives.length;
      if (nOptionalObjectives > 0) {
        for (let o = 0; o < nOptionalObjectives; o += 1) {
          const reducedCosts = this.optionalObjectives[o].reducedCosts;
          reducedCosts[this.rhsColumn]
            -= difference * reducedCosts[slackColumn];
        }
      }
    } else {
      // Slack variable of constraint is in base
      // Updating RHS with the difference between the old and the new one
      this.matrix[constraintRow][this.rhsColumn] -= difference;
    }
  }

  updateConstraintCoefficient(constraint, variable, difference) {
    // Updates variable coefficient within a constraint
    if (constraint.index === variable.index) {
      throw new Error(
        '[Tableau.updateConstraintCoefficient] constraint index should not be equal to variable index !'
      );
    }

    const r = this._putInBase(constraint.index);

    const colVar = this.colByVarIndex[variable.index];
    if (colVar === -1) {
      const rowVar = this.rowByVarIndex[variable.index];
      for (let c = 0; c < this.width; c += 1) {
        this.matrix[r][c] += difference * this.matrix[rowVar][c];
      }
    } else {
      this.matrix[r][colVar] -= difference;
    }
  }

  updateCost(variable, difference) {
    // Updates variable coefficient within the objective function
    const varIndex = variable.index;
    const lastColumn = this.width - 1;
    const varColumn = this.colByVarIndex[varIndex];
    if (varColumn === -1) {
      // Variable is in base
      const variableRow = this.matrix[this.rowByVarIndex[varIndex]];

      let c;
      if (variable.priority === 0) {
        const costRow = this.matrix[0];

        // Upading all the reduced costs
        for (c = 0; c <= lastColumn; c += 1) {
          costRow[c] += difference * variableRow[c];
        }
      } else {
        const reducedCosts = this.objectivesByPriority[variable.priority]
          .reducedCosts;
        for (c = 0; c <= lastColumn; c += 1) {
          reducedCosts[c] += difference * variableRow[c];
        }
      }
    } else {
      // Variable is not in the base
      // Updating coefficient with difference
      this.matrix[0][varColumn] -= difference;
    }
  }

  addConstraint(constraint) {
    // Adds a constraint to the tableau
    const sign = constraint.isUpperBound ? 1 : -1;
    const lastRow = this.height;

    let constraintRow = this.matrix[lastRow];
    if (constraintRow === undefined) {
      constraintRow = this.matrix[0].slice();
      this.matrix[lastRow] = constraintRow;
    }

    // Setting all row cells to 0
    const lastColumn = this.width - 1;
    for (var c = 0; c <= lastColumn; c += 1) {
      constraintRow[c] = 0;
    }

    // Initializing RHS
    constraintRow[this.rhsColumn] = sign * constraint.rhs;

    const terms = constraint.terms;
    const nTerms = terms.length;
    for (let t = 0; t < nTerms; t += 1) {
      const term = terms[t];
      const coefficient = term.coefficient;
      const varIndex = term.variable.index;

      const varRowIndex = this.rowByVarIndex[varIndex];
      if (varRowIndex === -1) {
        // Variable is non basic
        constraintRow[this.colByVarIndex[varIndex]] += sign * coefficient;
      } else {
        // Variable is basic
        const varRow = this.matrix[varRowIndex];
        const varValue = varRow[this.rhsColumn];
        for (c = 0; c <= lastColumn; c += 1) {
          constraintRow[c] -= sign * coefficient * varRow[c];
        }
      }
    }
    // Creating slack variable
    const slackIndex = constraint.index;
    this.varIndexByRow[lastRow] = slackIndex;
    this.rowByVarIndex[slackIndex] = lastRow;
    this.colByVarIndex[slackIndex] = -1;

    this.height += 1;
  }

  removeConstraint(constraint) {
    const slackIndex = constraint.index;
    const lastRow = this.height - 1;

    // Putting the constraint's slack in the base
    const r = this._putInBase(slackIndex);

    // Removing constraint
    // by putting the corresponding row at the bottom of the matrix
    // and virtually reducing the height of the matrix by 1
    const tmpRow = this.matrix[lastRow];
    this.matrix[lastRow] = this.matrix[r];
    this.matrix[r] = tmpRow;

    // Removing associated slack variable from basic variables
    this.varIndexByRow[r] = this.varIndexByRow[lastRow];
    this.varIndexByRow[lastRow] = -1;
    this.rowByVarIndex[slackIndex] = -1;

    // Putting associated slack variable index in index manager
    this.availableIndexes[this.availableIndexes.length] = slackIndex;

    constraint.slack.index = -1;

    this.height -= 1;
  }

  addVariable(variable) {
    // Adds a variable to the tableau
    // var sign = constraint.isUpperBound ? 1 : -1;

    const lastRow = this.height - 1;
    const lastColumn = this.width;
    const cost = this.model.isMinimization === true ? -variable.cost : variable.cost;
    const priority = variable.priority;

    // Setting reduced costs
    const nOptionalObjectives = this.optionalObjectives.length;
    if (nOptionalObjectives > 0) {
      for (let o = 0; o < nOptionalObjectives; o += 1) {
        this.optionalObjectives[o].reducedCosts[lastColumn] = 0;
      }
    }

    if (priority === 0) {
      this.matrix[0][lastColumn] = cost;
    } else {
      this.setOptionalObjective(priority, lastColumn, cost);
      this.matrix[0][lastColumn] = 0;
    }

    // Setting all other column cells to 0
    for (let r = 1; r <= lastRow; r += 1) {
      this.matrix[r][lastColumn] = 0;
    }

    // Adding variable to trackers
    const varIndex = variable.index;
    this.varIndexByCol[lastColumn] = varIndex;

    this.rowByVarIndex[varIndex] = -1;
    this.colByVarIndex[varIndex] = lastColumn;

    this.width += 1;
  }

  removeVariable(variable) {
    const varIndex = variable.index;

    // Putting the variable out of the base
    const c = this._takeOutOfBase(varIndex);
    const lastColumn = this.width - 1;
    if (c !== lastColumn) {
      const lastRow = this.height - 1;
      for (let r = 0; r <= lastRow; r += 1) {
        const row = this.matrix[r];
        row[c] = row[lastColumn];
      }

      const nOptionalObjectives = this.optionalObjectives.length;
      if (nOptionalObjectives > 0) {
        for (let o = 0; o < nOptionalObjectives; o += 1) {
          const reducedCosts = this.optionalObjectives[o].reducedCosts;
          reducedCosts[c] = reducedCosts[lastColumn];
        }
      }

      const switchVarIndex = this.varIndexByCol[lastColumn];
      this.varIndexByCol[c] = switchVarIndex;
      this.colByVarIndex[switchVarIndex] = c;
    }

    // Removing variable from non basic variables
    this.varIndexByCol[lastColumn] = -1;
    this.colByVarIndex[varIndex] = -1;

    // Adding index into index manager
    this.availableIndexes[this.availableIndexes.length] = varIndex;

    variable.index = -1;

    this.width -= 1;
  }

  countIntegerValues() {
    let count = 0;
    for (let r = 1; r < this.height; r += 1) {
      if (this.variablesPerIndex[this.varIndexByRow[r]].isInteger) {
        let decimalPart = this.matrix[r][this.rhsColumn];
        decimalPart -= Math.floor(decimalPart);
        if (decimalPart < this.precision && -decimalPart < this.precision) {
          count += 1;
        }
      }
    }

    return count;
  }

  //-------------------------------------------------------------------
  //-------------------------------------------------------------------
  isIntegral() {
    const integerVariables = this.model.integerVariables;
    const nIntegerVars = integerVariables.length;
    for (let v = 0; v < nIntegerVars; v++) {
      const varRow = this.rowByVarIndex[integerVariables[v].index];
      if (varRow === -1) {
        continue;
      }

      const varValue = this.matrix[varRow][this.rhsColumn];
      if (Math.abs(varValue - Math.round(varValue)) > this.precision) {
        return false;
      }
    }
    return true;
  }

  // Multiply all the fractional parts of variables supposed to be integer
  computeFractionalVolume(ignoreIntegerValues) {
    let volume = -1;
    // var integerVariables = this.model.integerVariables;
    // var nIntegerVars = integerVariables.length;
    // for (var v = 0; v < nIntegerVars; v++) {
    //     var r = this.rowByVarIndex[integerVariables[v].index];
    //     if (r === -1) {
    //         continue;
    //     }
    //     var rhs = this.matrix[r][this.rhsColumn];
    //     rhs = Math.abs(rhs);
    //     var decimalPart = Math.min(rhs - Math.floor(rhs), Math.floor(rhs + 1));
    //     if (decimalPart < this.precision) {
    //         if (!ignoreIntegerValues) {
    //             return 0;
    //         }
    //     } else {
    //         if (volume === -1) {
    //             volume = rhs;
    //         } else {
    //             volume *= rhs;
    //         }
    //     }
    // }

    for (let r = 1; r < this.height; r += 1) {
      if (this.variablesPerIndex[this.varIndexByRow[r]].isInteger) {
        let rhs = this.matrix[r][this.rhsColumn];
        rhs = Math.abs(rhs);
        const decimalPart = Math.min(
          rhs - Math.floor(rhs),
          Math.floor(rhs + 1)
        );
        if (decimalPart < this.precision) {
          if (!ignoreIntegerValues) {
            return 0;
          }
        } else if (volume === -1) {
          volume = rhs;
        } else {
          volume *= rhs;
        }
      }
    }

    if (volume === -1) {
      return 0;
    }
    return volume;
  }

  //-------------------------------------------------------------------
  // Description: Display a tableau matrix
  //              and additional tableau information
  //
  //-------------------------------------------------------------------
  log(message, force) {
    if (false && !force) {
      return;
    }

    console.log('****', message, '****');
    console.log('Nb Variables', this.width - 1);
    console.log('Nb Constraints', this.height - 1);
    // console.log("Variable Ids", this.variablesPerIndex);
    console.log('Basic Indexes', this.varIndexByRow);
    console.log('Non Basic Indexes', this.varIndexByCol);
    console.log('Rows', this.rowByVarIndex);
    console.log('Cols', this.colByVarIndex);

    const digitPrecision = 5;

    // Variable declaration
    let varNameRowString = '';

    const spacePerColumn = [' '];

    let j;

    let c;

    let s;

    let r;

    let variable;

    let varIndex;

    let varName;

    let varNameLength;

    let nSpaces;

    let valueSpace;

    let nameSpace;

    let row;

    let rowString;

    for (c = 1; c < this.width; c += 1) {
      varIndex = this.varIndexByCol[c];
      variable = this.variablesPerIndex[varIndex];
      if (variable === undefined) {
        varName = `c${varIndex}`;
      } else {
        varName = variable.id;
      }

      varNameLength = varName.length;
      nSpaces = Math.abs(varNameLength - 5);
      valueSpace = ' ';
      nameSpace = '\t';

      // /////////
      /* valueSpace = " ";
          nameSpace = " ";

          for (s = 0; s < nSpaces; s += 1) {
              if (varNameLength > 5) {
                  valueSpace += " ";
              } else {
                  nameSpace += " ";
              }
          } */

      // /////////
      if (varNameLength > 5) {
        valueSpace += ' ';
      } else {
        nameSpace += '\t';
      }

      spacePerColumn[c] = valueSpace;

      varNameRowString += nameSpace + varName;
    }
    console.log(varNameRowString);

    let signSpace;

    // Displaying reduced costs
    const firstRow = this.matrix[this.costRowIndex];
    let firstRowString = '\t';

    // /////////
    /* for (j = 1; j < this.width; j += 1) {
          signSpace = firstRow[j] < 0 ? "" : " ";
          firstRowString += signSpace;
          firstRowString += spacePerColumn[j];
          firstRowString += firstRow[j].toFixed(2);
      }
      signSpace = firstRow[0] < 0 ? "" : " ";
      firstRowString += signSpace + spacePerColumn[0] +
          firstRow[0].toFixed(2);
      console.log(firstRowString + " Z"); */

    // /////////
    for (j = 1; j < this.width; j += 1) {
      signSpace = '\t';
      firstRowString += signSpace;
      firstRowString += spacePerColumn[j];
      firstRowString += firstRow[j].toFixed(digitPrecision);
    }
    signSpace = '\t';
    firstRowString
      += signSpace + spacePerColumn[0] + firstRow[0].toFixed(digitPrecision);
    console.log(`${firstRowString}\tZ`);

    // Then the basic variable rowByVarIndex
    for (r = 1; r < this.height; r += 1) {
      row = this.matrix[r];
      rowString = '\t';

      // /////////
      /* for (c = 1; c < this.width; c += 1) {
              signSpace = row[c] < 0 ? "" : " ";
              rowString += signSpace + spacePerColumn[c] + row[c].toFixed(2);
          }
          signSpace = row[0] < 0 ? "" : " ";
          rowString += signSpace + spacePerColumn[0] + row[0].toFixed(2); */

      // /////////
      for (c = 1; c < this.width; c += 1) {
        signSpace = '\t';
        rowString
          += signSpace + spacePerColumn[c] + row[c].toFixed(digitPrecision);
      }
      signSpace = '\t';
      rowString
        += signSpace + spacePerColumn[0] + row[0].toFixed(digitPrecision);

      varIndex = this.varIndexByRow[r];
      variable = this.variablesPerIndex[varIndex];
      if (variable === undefined) {
        varName = `c${varIndex}`;
      } else {
        varName = variable.id;
      }
      console.log(`${rowString}\t${varName}`);
    }
    console.log('');

    // Then reduced costs for optional objectives
    const nOptionalObjectives = this.optionalObjectives.length;
    if (nOptionalObjectives > 0) {
      console.log('    Optional objectives:');
      for (let o = 0; o < nOptionalObjectives; o += 1) {
        const reducedCosts = this.optionalObjectives[o].reducedCosts;
        let reducedCostsString = '';
        for (j = 1; j < this.width; j += 1) {
          signSpace = reducedCosts[j] < 0 ? '' : ' ';
          reducedCostsString += signSpace;
          reducedCostsString += spacePerColumn[j];
          reducedCostsString += reducedCosts[j].toFixed(digitPrecision);
        }
        signSpace = reducedCosts[0] < 0 ? '' : ' ';
        reducedCostsString
          += signSpace
          + spacePerColumn[0]
          + reducedCosts[0].toFixed(digitPrecision);
        console.log(`${reducedCostsString} z${o}`);
      }
    }
    console.log('Feasible?', this.feasible);
    console.log('evaluation', this.evaluation);

    return this;
  }

  //-------------------------------------------------------------------
  // Function: solve
  // Detail: Main function, linear programming solver
  //-------------------------------------------------------------------
  simplex() {
    // Bounded until proven otherwise
    this.bounded = true;

    // Execute Phase 1 to obtain a Basic Feasible Solution (BFS)
    this.phase1();

    // Execute Phase 2
    if (this.feasible === true) {
      // Running simplex on Initial Basic Feasible Solution (BFS)
      // N.B current solution is feasible
      this.phase2();
    }

    return this;
  }

  //-------------------------------------------------------------------
  // Description: Convert a non standard form tableau
  //              to a standard form tableau by eliminating
  //              all negative values in the Right Hand Side (RHS)
  //              This results in a Basic Feasible Solution (BFS)
  //
  //-------------------------------------------------------------------
  phase1() {
    const debugCheckForCycles = this.model.checkForCycles;
    const varIndexesCycle = [];

    const matrix = this.matrix;
    const rhsColumn = this.rhsColumn;
    const lastColumn = this.width - 1;
    const lastRow = this.height - 1;

    let unrestricted;
    let iterations = 0;

    while (true) {
      // Selecting leaving variable (feasibility condition):
      // Basic variable with most negative value
      let leavingRowIndex = 0;
      let rhsValue = -this.precision;
      for (let r = 1; r <= lastRow; r++) {
        unrestricted = this.unrestrictedVars[this.varIndexByRow[r]] === true;
        if (unrestricted) {
          continue;
        }

        const value = matrix[r][rhsColumn];
        if (value < rhsValue) {
          rhsValue = value;
          leavingRowIndex = r;
        }
      }

      // If nothing is strictly smaller than 0; we're done with phase 1.
      if (leavingRowIndex === 0) {
        // Feasible, champagne!
        this.feasible = true;
        return iterations;
      }

      // Selecting entering variable
      let enteringColumn = 0;
      let maxQuotient = -Infinity;
      const costRow = matrix[0];
      const leavingRow = matrix[leavingRowIndex];
      for (let c = 1; c <= lastColumn; c++) {
        const coefficient = leavingRow[c];
        if (-this.precision < coefficient && coefficient < this.precision) {
          continue;
        }

        unrestricted = this.unrestrictedVars[this.varIndexByCol[c]] === true;
        if (unrestricted || coefficient < -this.precision) {
          const quotient = -costRow[c] / coefficient;
          if (maxQuotient < quotient) {
            maxQuotient = quotient;
            enteringColumn = c;
          }
        }
      }

      if (enteringColumn === 0) {
        // Not feasible
        this.feasible = false;
        return iterations;
      }

      if (debugCheckForCycles) {
        varIndexesCycle.push([
          this.varIndexByRow[leavingRowIndex],
          this.varIndexByCol[enteringColumn]
        ]);

        const cycleData = this.checkForCycles(varIndexesCycle);
        if (cycleData.length > 0) {
          console.log('Cycle in phase 1');
          console.log('Start :', cycleData[0]);
          console.log('Length :', cycleData[1]);
          throw new Error();
        }
      }

      this.pivot(leavingRowIndex, enteringColumn);
      iterations += 1;
    }
  }

  //-------------------------------------------------------------------
  // Description: Apply simplex to obtain optimal solution
  //              used as phase2 of the simplex
  //
  //-------------------------------------------------------------------
  phase2() {
    const debugCheckForCycles = this.model.checkForCycles;
    const varIndexesCycle = [];

    const matrix = this.matrix;
    const rhsColumn = this.rhsColumn;
    const lastColumn = this.width - 1;
    const lastRow = this.height - 1;

    const precision = this.precision;
    const nOptionalObjectives = this.optionalObjectives.length;
    let optionalCostsColumns = null;

    let iterations = 0;
    let reducedCost;
    let unrestricted;

    while (true) {
      const costRow = matrix[this.costRowIndex];

      // Selecting entering variable (optimality condition)
      if (nOptionalObjectives > 0) {
        optionalCostsColumns = [];
      }

      let enteringColumn = 0;
      let enteringValue = precision;
      let isReducedCostNegative = false;
      for (var c = 1; c <= lastColumn; c++) {
        reducedCost = costRow[c];
        unrestricted = this.unrestrictedVars[this.varIndexByCol[c]] === true;

        if (
          nOptionalObjectives > 0
          && -precision < reducedCost
          && reducedCost < precision
        ) {
          optionalCostsColumns.push(c);
          continue;
        }

        if (unrestricted && reducedCost < 0) {
          if (-reducedCost > enteringValue) {
            enteringValue = -reducedCost;
            enteringColumn = c;
            isReducedCostNegative = true;
          }
          continue;
        }

        if (reducedCost > enteringValue) {
          enteringValue = reducedCost;
          enteringColumn = c;
          isReducedCostNegative = false;
        }
      }

      if (nOptionalObjectives > 0) {
        // There exist optional improvable objectives
        let o = 0;
        while (
          enteringColumn === 0
          && optionalCostsColumns.length > 0
          && o < nOptionalObjectives
        ) {
          const optionalCostsColumns2 = [];
          const reducedCosts = this.optionalObjectives[o].reducedCosts;

          enteringValue = precision;

          for (let i = 0; i < optionalCostsColumns.length; i++) {
            c = optionalCostsColumns[i];

            reducedCost = reducedCosts[c];
            unrestricted = this.unrestrictedVars[this.varIndexByCol[c]] === true;

            if (-precision < reducedCost && reducedCost < precision) {
              optionalCostsColumns2.push(c);
              continue;
            }

            if (unrestricted && reducedCost < 0) {
              if (-reducedCost > enteringValue) {
                enteringValue = -reducedCost;
                enteringColumn = c;
                isReducedCostNegative = true;
              }
              continue;
            }

            if (reducedCost > enteringValue) {
              enteringValue = reducedCost;
              enteringColumn = c;
              isReducedCostNegative = false;
            }
          }
          optionalCostsColumns = optionalCostsColumns2;
          o += 1;
        }
      }

      // If no entering column could be found we're done with phase 2.
      if (enteringColumn === 0) {
        this.setEvaluation();
        return iterations;
      }

      // Selecting leaving variable
      let leavingRow = 0;
      let minQuotient = Infinity;

      const varIndexByRow = this.varIndexByRow;

      for (let r = 1; r <= lastRow; r++) {
        const row = matrix[r];
        const rhsValue = row[rhsColumn];
        const colValue = row[enteringColumn];

        if (-precision < colValue && colValue < precision) {
          continue;
        }

        if (colValue > 0 && precision > rhsValue && rhsValue > -precision) {
          minQuotient = 0;
          leavingRow = r;
          break;
        }

        const quotient = isReducedCostNegative
          ? -rhsValue / colValue
          : rhsValue / colValue;
        if (quotient > precision && minQuotient > quotient) {
          minQuotient = quotient;
          leavingRow = r;
        }
      }

      if (minQuotient === Infinity) {
        // optimal value is -Infinity
        this.evaluation = -Infinity;
        this.bounded = false;
        this.unboundedVarIndex = this.varIndexByCol[enteringColumn];
        return iterations;
      }

      if (debugCheckForCycles) {
        varIndexesCycle.push([
          this.varIndexByRow[leavingRow],
          this.varIndexByCol[enteringColumn]
        ]);

        const cycleData = this.checkForCycles(varIndexesCycle);
        if (cycleData.length > 0) {
          console.log('Cycle in phase 2');
          console.log('Start :', cycleData[0]);
          console.log('Length :', cycleData[1]);
          throw new Error();
        }
      }

      this.pivot(leavingRow, enteringColumn, true);
      iterations += 1;
    }
  }

  //-------------------------------------------------------------------
  // Description: Execute pivot operations over a 2d array,
  //          on a given row, and column
  //
  //-------------------------------------------------------------------
  pivot(pivotRowIndex, pivotColumnIndex) {
    const matrix = this.matrix;

    const quotient = matrix[pivotRowIndex][pivotColumnIndex];

    const lastRow = this.height - 1;
    const lastColumn = this.width - 1;

    const leavingBasicIndex = this.varIndexByRow[pivotRowIndex];
    const enteringBasicIndex = this.varIndexByCol[pivotColumnIndex];

    this.varIndexByRow[pivotRowIndex] = enteringBasicIndex;
    this.varIndexByCol[pivotColumnIndex] = leavingBasicIndex;

    this.rowByVarIndex[enteringBasicIndex] = pivotRowIndex;
    this.rowByVarIndex[leavingBasicIndex] = -1;

    this.colByVarIndex[enteringBasicIndex] = -1;
    this.colByVarIndex[leavingBasicIndex] = pivotColumnIndex;

    // Divide everything in the target row by the element @
    // the target column
    const pivotRow = matrix[pivotRowIndex];
    let nNonZeroColumns = 0;
    for (var c = 0; c <= lastColumn; c++) {
      if (pivotRow[c] !== 0) {
        pivotRow[c] /= quotient;
        nonZeroColumns[nNonZeroColumns] = c;
        nNonZeroColumns += 1;
      }
    }
    pivotRow[pivotColumnIndex] = 1 / quotient;

    // for every row EXCEPT the pivot row,
    // set the value in the pivot column = 0 by
    // multiplying the value of all elements in the objective
    // row by ... yuck... just look below; better explanation later
    let coefficient;
    let i;
    let v0;
    const precision = this.precision;
    for (let r = 0; r <= lastRow; r++) {
      const row = matrix[r];
      if (r !== pivotRowIndex) {
        coefficient = row[pivotColumnIndex];
        // No point Burning Cycles if
        // Zero to the thing
        if (coefficient !== 0) {
          for (i = 0; i < nNonZeroColumns; i++) {
            c = nonZeroColumns[i];
            // No point in doing math if you're just adding
            // Zero to the thing
            v0 = pivotRow[c];
            if (v0 !== 0) {
              row[c] = row[c] - coefficient * v0;
            }
          }

          row[pivotColumnIndex] = -coefficient / quotient;
        }
      }
    }

    const nOptionalObjectives = this.optionalObjectives.length;
    if (nOptionalObjectives > 0) {
      for (let o = 0; o < nOptionalObjectives; o += 1) {
        const reducedCosts = this.optionalObjectives[o].reducedCosts;
        coefficient = reducedCosts[pivotColumnIndex];
        if (coefficient !== 0) {
          for (i = 0; i < nNonZeroColumns; i++) {
            c = nonZeroColumns[i];
            v0 = pivotRow[c];
            if (v0 !== 0) {
              reducedCosts[c] = reducedCosts[c] - coefficient * v0;
            }
          }

          reducedCosts[pivotColumnIndex] = -coefficient / quotient;
        }
      }
    }
  }

  checkForCycles(varIndexes) {
    for (let e1 = 0; e1 < varIndexes.length - 1; e1++) {
      for (let e2 = e1 + 1; e2 < varIndexes.length; e2++) {
        const elt1 = varIndexes[e1];
        const elt2 = varIndexes[e2];
        if (elt1[0] === elt2[0] && elt1[1] === elt2[1]) {
          if (e2 - e1 > varIndexes.length - e2) {
            break;
          }
          let cycleFound = true;
          for (let i = 1; i < e2 - e1; i++) {
            const tmp1 = varIndexes[e1 + i];
            const tmp2 = varIndexes[e2 + i];
            if (tmp1[0] !== tmp2[0] || tmp1[1] !== tmp2[1]) {
              cycleFound = false;
              break;
            }
          }
          if (cycleFound) {
            return [e1, e2 - e1];
          }
        }
      }
    }
    return [];
  }
}

class OptionalObjective {
  constructor(priority, nColumns) {
    this.priority = priority;
    this.reducedCosts = new Array(nColumns);
    for (let c = 0; c < nColumns; c += 1) {
      this.reducedCosts[c] = 0;
    }
  }

  copy() {
    const copy = new OptionalObjective(this.priority, this.reducedCosts.length);
    copy.reducedCosts = this.reducedCosts.slice();
    return copy;
  }
}

//-------------------------------------------------------------------
//-------------------------------------------------------------------
function Cut(type, varIndex, value) {
  this.type = type;
  this.varIndex = varIndex;
  this.value = value;
}

//-------------------------------------------------------------------
//-------------------------------------------------------------------
function Branch(relaxedEvaluation, cuts) {
  this.relaxedEvaluation = relaxedEvaluation;
  this.cuts = cuts;
}

//-------------------------------------------------------------------
// Branch sorting strategies
//-------------------------------------------------------------------
function sortByEvaluation(a, b) {
  return b.relaxedEvaluation - a.relaxedEvaluation;
}

function VariableData(index, value) {
  this.index = index;
  this.value = value;
}

// Array holding the column indexes for which the value is not null
// on the pivot row
// Shared by all tableaux for smaller overhead and lower memory usage
const nonZeroColumns = [];

// All functions in this module that
// get exported to main ***MUST***
// return a functional LPSolve JSON style
// model or throw an error

export const CleanObjectiveAttributes = function (model) {
  // Test to see if the objective attribute
  // is also used by one of the constraints
  //
  // If so...create a new attribute on each
  // variable
  let fakeAttr;

  let x;
  let z;

  if (typeof model.optimize === 'string') {
    if (model.constraints[model.optimize]) {
      // Create the new attribute
      fakeAttr = Math.random();

      // Go over each variable and check
      for (x in model.variables) {
        // Is it there?
        if (model.variables[x][model.optimize]) {
          model.variables[x][fakeAttr] = model.variables[x][model.optimize];
        }
      }

      // Now that we've cleaned up the variables
      // we need to clean up the constraints
      model.constraints[fakeAttr] = model.constraints[model.optimize];
      delete model.constraints[model.optimize];
      return model;
    }
    return model;
  }
  // We're assuming its an object?
  for (z in model.optimize) {
    if (model.constraints[z]) {
      // Make sure that the constraint
      // being optimized isn't constrained
      // by an equity collar
      if (model.constraints[z] === 'equal') {
        // Its constrained by an equal sign;
        // delete that objective and move on
        delete model.optimize[z];
      } else {
        // Create the new attribute
        fakeAttr = Math.random();

        // Go over each variable and check
        for (x in model.variables) {
          // Is it there?
          if (model.variables[x][z]) {
            model.variables[x][fakeAttr] = model.variables[x][z];
          }
        }
        // Now that we've cleaned up the variables
        // we need to clean up the constraints
        model.constraints[fakeAttr] = model.constraints[z];
        delete model.constraints[z];
      }
    }
  }
  return model;
};

//-------------------------------------------------------------------
//-------------------------------------------------------------------
export class Variable {
  constructor(id, cost, index, priority) {
    this.id = id;
    this.cost = cost;
    this.index = index;
    this.value = 0;
    this.priority = priority;
  }
}

export class IntegerVariable extends Variable {
  isInteger = true
}

class SlackVariable extends Variable {
  isSlack = true

  constructor(id, index) {
    super(id, 0, index, 0);
  }
}

function SlackVariable(id, index) {
  Variable.call(this, id, 0, index, 0);
}
SlackVariable.prototype.isSlack = true;

//-------------------------------------------------------------------
//-------------------------------------------------------------------
function Term(variable, coefficient) {
  this.variable = variable;
  this.coefficient = coefficient;
}

function createRelaxationVariable(model, weight, priority) {
  if (priority === 0 || priority === 'required') {
    return null;
  }

  weight = weight || 1;
  priority = priority || 1;

  if (model.isMinimization === false) {
    weight = -weight;
  }

  return model.addVariable(
    weight,
    `r${model.relaxationIndex++}`,
    false,
    false,
    priority
  );
}

//-------------------------------------------------------------------
//-------------------------------------------------------------------
class Constraint {
  constructor(rhs, isUpperBound, index, model) {
    this.slack = new SlackVariable(`s${index}`, index);
    this.index = index;
    this.model = model;
    this.rhs = rhs;
    this.isUpperBound = isUpperBound;

    this.terms = [];
    this.termsByVarIndex = {};

    // Error variable in case the constraint is relaxed
    this.relaxation = null;
  }

  addTerm(coefficient, variable) {
    const varIndex = variable.index;
    let term = this.termsByVarIndex[varIndex];
    if (term === undefined) {
      // No term for given variable
      term = new Term(variable, coefficient);
      this.termsByVarIndex[varIndex] = term;
      this.terms.push(term);
      if (this.isUpperBound === true) {
        coefficient = -coefficient;
      }
      this.model.updateConstraintCoefficient(this, variable, coefficient);
    } else {
      // Term for given variable already exists
      // updating its coefficient
      const newCoefficient = term.coefficient + coefficient;
      this.setVariableCoefficient(newCoefficient, variable);
    }

    return this;
  }

  removeTerm(term) {
    // TODO
    return this;
  }

  setRightHandSide(newRhs) {
    if (newRhs !== this.rhs) {
      let difference = newRhs - this.rhs;
      if (this.isUpperBound === true) {
        difference = -difference;
      }

      this.rhs = newRhs;
      this.model.updateRightHandSide(this, difference);
    }

    return this;
  }

  setVariableCoefficient(newCoefficient, variable) {
    const varIndex = variable.index;
    if (varIndex === -1) {
      console.warn(
        '[Constraint.setVariableCoefficient] Trying to change coefficient of inexistant variable.'
      );
      return;
    }

    const term = this.termsByVarIndex[varIndex];
    if (term === undefined) {
      // No term for given variable
      this.addTerm(newCoefficient, variable);
    } else {
      // Term for given variable already exists
      // updating its coefficient if changed
      if (newCoefficient !== term.coefficient) {
        let difference = newCoefficient - term.coefficient;
        if (this.isUpperBound === true) {
          difference = -difference;
        }

        term.coefficient = newCoefficient;
        this.model.updateConstraintCoefficient(this, variable, difference);
      }
    }

    return this;
  }

  relax(weight, priority) {
    this.relaxation = createRelaxationVariable(this.model, weight, priority);
    this._relax(this.relaxation);
  }

  _relax(relaxationVariable) {
    if (relaxationVariable === null) {
      // Relaxation variable not created, priority was probably "required"
      return;
    }

    if (this.isUpperBound) {
      this.setVariableCoefficient(-1, relaxationVariable);
    } else {
      this.setVariableCoefficient(1, relaxationVariable);
    }
  }
}

//-------------------------------------------------------------------
//-------------------------------------------------------------------
class Equality {
  isEquality = true;

  constructor(constraintUpper, constraintLower) {
    this.upperBound = constraintUpper;
    this.lowerBound = constraintLower;
    this.model = constraintUpper.model;
    this.rhs = constraintUpper.rhs;
    this.relaxation = null;
  }

  addTerm(coefficient, variable) {
    this.upperBound.addTerm(coefficient, variable);
    this.lowerBound.addTerm(coefficient, variable);
    return this;
  }

  removeTerm(term) {
    this.upperBound.removeTerm(term);
    this.lowerBound.removeTerm(term);
    return this;
  }

  setRightHandSide(rhs) {
    this.upperBound.setRightHandSide(rhs);
    this.lowerBound.setRightHandSide(rhs);
    this.rhs = rhs;
  }

  relax(weight, priority) {
    this.relaxation = createRelaxationVariable(this.model, weight, priority);
    this.upperBound.relaxation = this.relaxation;
    this.upperBound._relax(this.relaxation);
    this.lowerBound.relaxation = this.relaxation;
    this.lowerBound._relax(this.relaxation);
  }
}

const bar = {
  Constraint,
  Variable,
  IntegerVariable,
  SlackVariable,
  Equality,
  Term
};

var Constraint = expressions.Constraint;
var Variable = expressions.Variable;
const Numeral = expressions.Numeral;
var Term = expressions.Term;

// Place everything under the Solver Name Space
export function Solver() {
  this.Constraint = Constraint;
  this.Variable = Variable;
  this.Numeral = Numeral;
  this.Term = Term;
  this.Tableau = Tableau;

  this.lastSolvedModel = null;

  /** ***********************************************************
   * Method: Solve
   * Scope: Public:
   * Agruments:
   *        model: The model we want solver to operate on
   *        precision: If we're solving a MILP, how tight
   *                   do we want to define an integer, given
   *                   that 20.000000000000001 is not an integer.
   *                   (defaults to 1e-9)
   *            full: *get better description*
   *        validate: if left blank, it will get ignored; otherwise
   *                  it will run the model through all validation
   *                  functions in the *Validate* module
   ************************************************************* */
  this.Solve = function (model, precision, full, validate) {
    // Run our validations on the model
    // if the model doesn't have a validate
    // attribute set to false
    if (validate) {
      for (const test in validation) {
        model = validation[test](model);
      }
    }

    // Make sure we at least have a model
    if (!model) {
      throw new Error('Solver requires a model to operate on');
    }

    if (model instanceof Model === false) {
      model = new Model(precision).loadJson(model);
    }

    const solution = model.solve();
    this.lastSolvedModel = model;
    constution.solutionSet = solution.generateSolutionSet();

    // If the user asks for a full breakdown
    // of the tableau (e.g. full === true)
    // this will return it
    if (full) {
      return solution;
    }
    // Otherwise; give the user the bare
    // minimum of info necessary to carry on

    const store = {};

    // 1.) Add in feasibility to store;
    store.feasible = solution.feasible;

    // 2.) Add in the objective value
    store.result = solution.evaluation;

    store.bounded = solution.bounded;

    // 3.) Load all of the variable values
    Object.keys(solution.solutionSet).map((d) => {
      store[d] = solution.solutionSet[d];
    });
  };

  /** ***********************************************************
   * Method: ReformatLP
   * Scope: Public:
   * Agruments: model: The model we want solver to operate on
   * Purpose: Convert a friendly JSON model into a model for a
   *          real solving library...in this case
   *          lp_solver
   ************************************************************* */
  this.ReformatLP = require('./Reformat');

  /** ***********************************************************
   * Method: MultiObjective
   * Scope: Public:
   * Agruments:
   *        model: The model we want solver to operate on
   *        detail: if false, or undefined; it will return the
   *                result of using the mid-point formula; otherwise
   *                it will return an object containing:
   *
   *                1. The results from the mid point formula
   *                2. The solution for each objective solved
   *                   in isolation (pareto)
   *                3. The min and max of each variable along
   *                   the frontier of the polytope (ranges)
   * Purpose: Solve a model with multiple objective functions.
   *          Since a potential infinite number of solutions exist
   *          this naively returns the mid-point between
   *
   * Note: The model has to be changed a little to work with this.
   *       Before an *opType* was required. No more. The objective
   *       attribute of the model is now an object instead of a
   *       string.
   *
   *  *EXAMPLE MODEL*
   *
   *   model = {
   *       optimize: {scotch: "max", soda: "max"},
   *       constraints: {fluid: {equal: 100}},
   *       variables: {
   *           scotch: {fluid: 1, scotch: 1},
   *           soda: {fluid: 1, soda: 1}
   *       }
   *   }
   *
   ************************************************************* */
  this.MultiObjective = function (model) {
    return require('./Polyopt')(this, model);
  };
}
