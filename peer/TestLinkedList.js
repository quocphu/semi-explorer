var LinkedList = require('./LinkedList.js');

var list = new LinkedList();


var A = {
    key: 'A',
    value: {
        prev: '',
        block: {},
        blockHeight: 0
    }
};

var B = {
    key: 'B',
    value: {
        prev: 'A',
        block: {}
    }
};

var C = {
    key: 'C',
    value: {
        prev: 'B',
        block: {}
    }
};

var D = {
    key: 'D',
    value: {
        prev: 'C',
        block: {}
    }
};

var D1 = {
    key: 'D1',
    value: {
        prev: 'C',
        block: {}
    }
};

var E = {
    key: 'E',
    value: {
        prev: 'D1',
        block: {}
    }
};

list.add(A);
list.add(B);
list.add(C);
list.add(D);

/**
 * A - B - C - D
 */
// console.log(list);
// console.log(list.getLongestChain('C'));

list.add(D1);
list.add(E);

/**
 * A - B - C - D
 *           \
 *            D1 - E
 *           
 */

// console.log(list);
// console.log(list.getLongestChain('A'));

/**
 * A - B - C - D
 *         / \
 *         D2  D1 - E
 *           \
 *            E1 - F
 */

var D2 = {
    key: 'D2',
    value: {
        prev: 'C',
        block: {}
    }
};

var E1 = {
    key: 'E1',
    value: {
        prev: 'D2',
        block: {}
    }
};

var F = {
    key: 'F',
    value: {
        prev: 'E1',
        block: {}
    }
};

list.add(D2);
list.add(E1);
list.add(F);

console.log(list);
// console.log(list.getLongestChain('A'));
console.log(list.getLongestChain('A'));
// console.log(list.getLongestChain('F'));
// console.log(list.getLongestChain('D2'));

console.log(list);
// console.log(list.getHeight('A'));
// console.log(list.getHeight('C'));
// console.log(list.getHeight('D2'));
// console.log(list.getHeight('F'));

// console.log(list);
// console.log(list.remove('A'));
// console.log(list);