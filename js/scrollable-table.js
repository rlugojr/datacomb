//
//
// UI Component that manages a (large) scrollable table by reusing row <div> nodes
//  allows for rows to be different heights and dynamic sizing
//
// a la: https://github.com/NeXTs/Clusterize.js, https://github.com/facebook/fixed-data-table
//
//  |       | <- total table area, rows exist in data, but not on dom
//  |xxxxxxx| <- buffer of rows on dom, but not visible
//  |-------|
//  |#######| <- visible screen area
//  |#######|
//  |-------|
//  |xxxxxxx|
//  |       |

// Required params:
//  el: container element to render to
//  data: array of objects containing row data
//  buildRow: called when first building table rows (return node)
//  updateRow: called when switching row data into a dom node

//
var _  = require('lodash'),
    d3 = require('d3');

//
var defaults = {
  heightFn: function() { return 10; },
  availableNodes: 100,
  visibleHeight: 400
};

//
var ScrollableTable = function(opts) {
  _.extend(this, defaults, opts);
  if(!this.el) { throw new Error("Need to pass `el` into ScrollableTable."); }
  if(!this.data) { throw new Error("Need to pass `data` into ScrollableTable."); }
  if(!this.buildRow) { throw new Error("Need to pass `buildRow` into ScrollableTable."); }
  if(!this.updateRow) { throw new Error("Need to pass `updateRow` into ScrollableTable."); }

  //
  this.elSel = d3.select(this.el);
  this.rowsWithNodes = []; // indices of rows w/ active dom nodes
  this.reset();
  window.st = this;
};

//
//

// Reset or init dom elements and scrolling state
ScrollableTable.prototype.reset = function() {
  this.yPosition = 0;
  this.setHeight();

  // clear nodes and rebuild using `buildRow`
  while (this.el.firstChild) { this.el.remove(this.el.firstChild); }

  // clear all references between data and nodes
  for(var ndx = 0; ndx < this.data.length; ndx++) { this.data[ndx].__node = null; }

  // create new nodes and position absolutely
  this.rowsWithNodes = [];
  var nodesToBuild = Math.min(this.availableNodes, this.data.length);
  for(var ndx = 0; ndx < nodesToBuild; ndx++) {
    var newRow = this.buildRow(this.data[ndx]);
    newRow.style.top = this.data[ndx].__top + 'px';
    this.el.appendChild(newRow);
    this.rowsWithNodes.push(ndx);
    this.data[ndx].__node = newRow;
  }

  // add node to stick to bottom to preserve height
  this.bottomEl = document.createElement('div');
  this.bottomEl.innerText = '.';
  this.bottomEl.style.position = 'absolute';
  this.bottomEl.style.top = this.totalHeight + 'px';
  this.el.appendChild(this.bottomEl);

  // setup scroll handling
  //this.elSel.on('scroll', this.updateVisibleRows);
  // window.request animation frame ???
  this.el.addEventListener('scroll', this.updateVisibleRows.bind(this));
};

//
//

//
ScrollableTable.prototype.updateVisibleRows = function(evt) {
  if(this.isUpdating) { return; }
  this.isUpdating = true;
  var start = performance.now();
  var screenTop = this.el.scrollTop,
      screenBottom = this.el.scrollTop + this.el.clientHeight,
      screenMidpoint = (screenTop + screenBottom) / 2,
      midNdx = _.sortedIndex(this.data, { __top: screenMidpoint }, '__top'),
      freeSearchNdx = 0,
      fillStart = Math.max(0, midNdx - Math.ceil(this.availableNodes / 2)),
      fillEnd = Math.min(this.data.length, midNdx + Math.ceil(this.availableNodes / 2));
  if(this.lastMidNdx === midNdx) { this.isUpdating = false; return; }
  this.lastMidNdx = midNdx;

  for(var rowNdx = fillStart; rowNdx < fillEnd; rowNdx++) {
    if(!this.data[rowNdx].__node) {
      while(this.rowsWithNodes[freeSearchNdx] > fillStart &&
            this.rowsWithNodes[freeSearchNdx] < fillEnd) { freeSearchNdx++; }
      this.data[rowNdx].__node = this.data[this.rowsWithNodes[freeSearchNdx]].__node;
      this.updateRow(this.data[rowNdx], this.data[rowNdx].__node);
      this.data[rowNdx].__node.style.top = this.data[rowNdx].__top + 'px';
      this.data[this.rowsWithNodes[freeSearchNdx]].__node = null;
      this.rowsWithNodes[freeSearchNdx] = rowNdx;
      freeSearchNdx++;
    }
  }
  this.isUpdating = false;
  var timeElapsed = performance.now() - start;
  console.log(timeElapsed + ' ms');

  ///////////////////
  // FIRST PASS...
  // var visibleTop = this.el.scrollTop,
  //     visibleBot = this.el.scrollTop + this.el.clientHeight,
  //     visibleMid = this.el.scrollTop + (this.el.clientHeight / 2),
  //     midNdx = _.sortedIndex(this.data, { __top: visibleMid }, '__top'),

  //     // Visible scroll area is nearer to top of dataset
  //     nearerToTop = midNdx < (this.data.length / 2),
  //     freeNodeSearchNdx = nearerToTop ? this.data.length-1 : 0;

  // console.log('updating...', nearerToTop, freeNodeSearchNdx, midNdx);

  // Find rows in data that are nearest to the midpoint, but do not have existing nodes
  //  then find rows in data furthest from the midpoint with existing nodes...
  // for(var ndx = 0; ndx < this.data.length; ndx++) {
  //     if(nearerToTop) {
  //       while(!this.data[freeNodeSearchNdx].__node && freeNodeSearchNdx) { freeNodeSearchNdx--; }
  //     } else {
  //       while(!this.data[freeNodeSearchNdx].__node && freeNodeSearchNdx > this.data.length) { freeNodeSearchNdx++; }
  //     }
  //   if(!this.data[ndx].__node &&
  //    (Math.abs(midNdx - ndx) < Math.abs(midNdx - freeNodeSearchNdx))) {
  //     console.log('switching rows', freeNodeSearchNdx, ndx);
  //     this.data[ndx].__node = this.data[freeNodeSearchNdx].__node;
  //     this.updateRow(this.data[ndx], this.data[ndx].__node);
  //     this.data[ndx].__node.style.top = this.data[ndx].__top + 'px';
  //     this.data[freeNodeSearchNdx].__node = null;
  //   }
  // }
};

//
//

//
ScrollableTable.prototype.calculateHeights = function(heightFn) {
  this.totalHeight = 0;
  for(var ndx = 0; ndx < this.data.length; ndx++) {
    this.data[ndx].__top = this.totalHeight;
    this.totalHeight += this.heightFn(this.data[ndx]);
  }
  return this.totalHeight;
};
ScrollableTable.prototype.setHeight = function(heightFn) {
  this.calculateHeights();
  this.elSel.style({
    height: this.visibleHeight+'px',
    overflow: 'scroll',
    position: 'relative'
  });
};


//
module.exports = ScrollableTable;
