var logger = require('./logger.js')
var LinkedList = function(){
    this.data = {};
    this.limitLen = 6;
    this.len = 0;
    this.firstElement = '';
};

LinkedList.prototype.update = function(key, value) {
    // Key does not exist
    if(!this.data[key]) {
        return;
    }

    // Value is null
    if(!value || !value.prev) {
        return;
    }

    // If prev propterty has value
    if(this.data[key].prev) {
        this.data[key].block = value.block;
        return;
    }

    // Prev key does not exist --> remove this node
    if(!this.data[value.prev]) {
        return this.remove(key, true);
    }

    this.data[key].prev = value.prev;
    this.data[key].block = value.block;

    if(this.data[value.prev].blockHeight) {
        this.data[key].blockHeight = this.data[value.prev].blockHeight + 1;
    }
// console.log('uipdate liest:', this.data[value.prev].blockHeight);
    // // Remove shorter chain
    // var longest1 = this.getLongestChain(key);
    // var longest2 = this.getLongestChain(value.prev);

    // if(longest1.key == longest2.key) {
    //     return;
    // }

    // if(longest1.path.length + 1 <= longest2.path.length) {
    //     return this.remove(key, true);
    // }

    return;
}

/**
 * data = {
 *  key: keyx
 *  value: {
 *      prev: prevKey,
 *      block: blockdata
 *  }
 * }
 */
LinkedList.prototype.add = function(data) {
    // console.log('add: ', data.key);
    if (!data) {
        logger.error('Data is undefined');
        return;
    }
    
    if(!data.key) {
        logger.error('data.key is undefined');
        return;
    }

    if(!data.value) {
        logger.error('data.value is undefined');
        return;
    }

    if(this.data[data.key]) {
        logger.error('data.key existed');
        console.log(data.key);
        console.log(this.data);
        throw 'data.key existed'
    }
    if(this.len == 0) {
        this.firstElement = data.key;
    }
    this.data[data.key] = data.value;
    this.len++;
}

LinkedList.prototype.get = function (key) {
    return this.data[key];
}

/**
 * Get longest chain from specific key.
 * Using Deep First Search algorithm
 */
LinkedList.prototype.getLongestChain = function(key) {
    if(!this.data[key]) {
        return null;
    }

    var stack = [];
    var visited = {};
    var allPaths = {};
    var s = key;
    stack.push(s);

    while(stack.length > 0) {
        // Get last item in stack
        s = stack[stack.length-1];
        visited[s] = 1;

        // Find adjacent vertex
        var adj = this.findAdjacent(s, visited);
        if(!adj) {
            allPaths[s] = stack.slice(0);
            // allPaths[s] = stack.length;
            stack.pop();
            continue;
        }
        stack.push(adj);
    }

    // Find max length in all paths were found
    var max = {
        farthestKey: '',
        path: [],
        orphan: []
    };
    for (var i in allPaths) {
        if(allPaths[i].length > max.path.length) {
            max.farthestKey = i;
            max.path = allPaths[i];
        }
    }

    for (var i in allPaths) {
        var notFound = true;
        for(var j = 0; j < max.path.length; j++) {
            if(i == max.path[j]) {
                notFound = false;
                break;
            }
        }

        if(notFound) {
            max.orphan.push(i);
        }
    }

    // Update block height from first element
    for(var i = 1; i< max.path.length; i++) {
        this.data[max.path[i]].blockHeight = this.data[max.path[i-1]].blockHeight + 1;
    }
    return max;
}

LinkedList.prototype.findAdjacent = function (key, visited) {
    var data = this.data;
    // if(data[key] && data[key].prev && data[data[key].prev]) {
    //     if(!visited[data[key].prev]){
    //         return data[key].prev;
    //     }
    // }
    for (var k in data) {
        if (data[k] && data[k].prev && data[k].prev == key) {
            if (visited[k]) {
                continue;
            }
            return k;
        }
    }
    return null;
}

/**
 * Get all first child of key
 * return array of key
 */
LinkedList.prototype.getChildren = function (key, diffKey) {
    var data = this.data;
    var rs = [];
    for (var k in data) {
        if (data[k] && data[k].prev && data[k].prev == key) {
            if (diffKey) {
                if(diffKey != k) {
                    rs.push(k); 
                }
            } else {
                rs.push(k);
            }
        }
    }
    return rs;
}

LinkedList.prototype.remove = function(key, removeChildren) {
    // console.log('remove: ', key);
    var removedData = [];
    if(this.firstElement == key) {
        for(var k in this.data) {
            if(this.data[k] && this.data[k].prev == this.firstElement) {
                this.firstElement = k;
                break;
            }
        }
    }

    if (removeChildren) {
        var stack = [];
        var visited = {};
        var allPaths = {};
        var s = key;
        stack.push(s);

        while (stack.length > 0) {
            // Get last item in stack
            s = stack[stack.length - 1];
            visited[s] = 1;

            // Find adjacent vertex
            var adj = this.findAdjacent(s, visited);
            if (!adj) {
                removedData.push({key: s, value: this.data[s]});
                delete this.data[s];
                this.len--;
                stack.pop();
                continue;
            }

            stack.push(adj);
        }
    } else {
        removedData.push({key: key, value: this.data[key]});
        delete this.data[key];
        this.len--;
    }

    return removedData;
}

LinkedList.prototype.getHeight = function(key) {
    if(key == this.firstElement) {
        return 1;
    }

    var node = this.data[key];
    var height = 0;

    while(node && node.key != this.firstElement) {
        height++;
        node = this.data[node.prev];
    }
    return height;
}

LinkedList.prototype.getLength = function() {
    return this.len;
}

LinkedList.prototype.getFirstKey = function() {
    return this.firstElement;
}

module.exports = LinkedList;