/**
* Copyright 2012-2016, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var polygon = require('../../lib/polygon');
var color = require('../../components/color');

var axes = require('./axes');
var constants = require('./constants');

var filteredPolygon = polygon.filter;
var polygonTester = polygon.tester;
var MINDRAG = constants.MINDRAG;

function getAxId(ax) { return ax._id; }

module.exports = function prepSelect(e, startX, startY, dragOptions, mode) {
    var plot = dragOptions.plotinfo.plot,
        dragBBox = dragOptions.element.getBoundingClientRect(),
        x0 = startX - dragBBox.left,
        y0 = startY - dragBBox.top,
        x1 = x0,
        y1 = y0,
        path0 = 'M' + x0 + ',' + y0,
        pw = dragOptions.xaxes[0]._length,
        ph = dragOptions.yaxes[0]._length,
        xAxisIds = dragOptions.xaxes.map(getAxId),
        yAxisIds = dragOptions.yaxes.map(getAxId);

    if(mode === 'lasso') {
        var pts = filteredPolygon([[x0, y0]], constants.BENDPX);
    }

    var outlines = plot.selectAll('path.select-outline').data([1,2]);

    outlines.enter()
        .append('path')
        .attr('class', function(d) { return 'select-outline select-outline-' + d; })
        .attr('d', path0 + 'Z');

    var corners = plot.append('path')
        .attr('class', 'zoombox-corners')
        .style({
            fill: color.background,
            stroke: color.defaultLine,
            'stroke-width': 1
        })
        .attr('d','M0,0Z');


    // find the traces to search for selection points
    var searchTraces = [],
        gd = dragOptions.gd,
        i,
        cd,
        trace,
        searchInfo,
        selection = [],
        eventData;
    for(i = 0; i < gd.calcdata.length; i++) {
        cd = gd.calcdata[i];
        trace = cd[0].trace;
        if(!trace._module || !trace._module.selectPoints) continue;

        if(xAxisIds.indexOf(trace.xaxis) === -1) continue;
        if(yAxisIds.indexOf(trace.yaxis) === -1) continue;

        searchTraces.push({
            selectPoints: trace._module.selectPoints,
            cd: cd,
            xaxis: axes.getFromId(gd, trace.xaxis),
            yaxis: axes.getFromId(gd, trace.yaxis)
        });
    }

    dragOptions.moveFn = function(dx0, dy0) {
        var poly;
        x1 = Math.max(0, Math.min(pw, dx0 + x0));
        y1 = Math.max(0, Math.min(ph, dy0 + y0));

        var dx = Math.abs(x1 - x0),
            dy = Math.abs(y1 - y0);

        if(mode === 'select') {
            if(dy < Math.min(dx * 0.6, MINDRAG)) {
                // horizontal motion: make a vertical box
                poly = polygonTester([[x0, 0], [x0, ph], [x1, ph], [x1, 0]]);
                // extras to guide users in keeping a straight selection
                corners.attr('d', 'M' + poly.xmin + ',' + (y0 - MINDRAG) +
                    'h-4v' + (2 * MINDRAG) + 'h4Z' +
                    'M' + (poly.xmax - 1) + ',' + (y0 - MINDRAG) +
                    'h4v' + (2 * MINDRAG) + 'h-4Z');

            }
            else if(dx < Math.min(dy * 0.6, MINDRAG)) {
                // vertical motion: make a horizontal box
                poly = polygonTester([[0, y0], [0, y1], [pw, y1], [pw, y0]]);
                corners.attr('d', 'M' + (x0 - MINDRAG) + ',' + poly.ymin +
                    'v-4h' + (2 * MINDRAG) + 'v4Z' +
                    'M' + (x0 - MINDRAG) + ',' + (poly.ymax - 1) +
                    'v4h' + (2 * MINDRAG) + 'v-4Z');
            }
            else {
                // diagonal motion
                poly = polygonTester([[x0, y0], [x0, y1], [x1, y1], [x1, y0]]);
                corners.attr('d','M0,0Z');
            }
            outlines.attr('d', 'M' + poly.xmin + ',' + poly.ymin +
                'H' + (poly.xmax - 1) + 'V' + (poly.ymax - 1) +
                'H' + poly.xmin + 'Z');
        }
        else if(mode === 'lasso') {
            pts.addPt([x1, y1]);
            poly = polygonTester(pts.filtered);
            outlines.attr('d', 'M' + pts.filtered.join('L') + 'Z');
        }

        selection = [];
        for(i = 0; i < searchTraces.length; i++) {
            searchInfo = searchTraces[i];
            [].push.apply(selection, searchInfo.selectPoints(searchInfo, poly));
        }

        eventData = {points: selection};
        dragOptions.gd.emit('plotly_selecting', eventData);
    };

    dragOptions.doneFn = function(dragged, numclicks) {
        if(!dragged && numclicks === 2) dragOptions.doubleclick();
        else {
            dragOptions.gd.emit('plotly_selected', eventData);
        }
        outlines.remove();
        corners.remove();
        for(i = 0; i < searchTraces.length; i++) {
            searchInfo = searchTraces[i];
            searchInfo.selectPoints(searchInfo, false);
        }
    };
};

