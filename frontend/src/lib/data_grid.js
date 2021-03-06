import _ from "underscore";

import * as SchemaMetadata from "metabase/lib/schema_metadata";

function compareNumbers(a, b) {
    return a - b;
}


var DataGrid = {
    filterOnPreviewDisplay: function(data) {
        // find any columns where preview_display = false
        var hiddenColumnIdxs = _.map(data.cols, function(col, idx) { if(!col.preview_display) return idx; });
        hiddenColumnIdxs = _.filter(hiddenColumnIdxs, function(val) { return val !== undefined; });

        // filter out our data grid using the indexes of the hidden columns
        var filteredRows = data.rows.map(function(row, rowIdx) {
            return row.filter(function(cell, cellIdx) {
                if (_.contains(hiddenColumnIdxs, cellIdx)) {
                    return false;
                } else {
                    return true;
                }
            });
        });

        return {
            cols: _.filter(data.cols, function(col) { return col.preview_display; }),
            columns: _.map(data.cols, function(col) { return col.display_name; }),
            rows: filteredRows,
            rows_truncated: data.rows_truncated
        };
    },

    pivot: function(data) {
        // find the lowest cardinality dimension and make it our "pivoted" column
        // TODO: we assume dimensions are in the first 2 columns, which is less than ideal
        var pivotCol = 0,
            normalCol = 1,
            pivotColValues = DataGrid.distinctValues(data, pivotCol),
            normalColValues = DataGrid.distinctValues(data, normalCol);
        if (normalColValues.length <= pivotColValues.length) {
            pivotCol = 1;
            normalCol = 0;

            var tmp = pivotColValues;
            pivotColValues = normalColValues;
            normalColValues = tmp;
        }

        // sort the column values sensibly
        if (SchemaMetadata.isNumeric(data.cols[pivotCol])) {
            pivotColValues.sort(compareNumbers);
        } else {
            pivotColValues.sort();
        }

        if (SchemaMetadata.isNumeric(data.cols[normalCol])) {
            normalColValues.sort(compareNumbers);
        } else {
            normalColValues.sort();
        }


        // make sure that the first element in the pivoted column list is null which makes room for the label of the other column
        pivotColValues.unshift(data.cols[normalCol].display_name);

        // start with an empty grid that we'll fill with the appropriate values
        var pivotedRows = [];
        var emptyRow = Array.apply(null, Array(pivotColValues.length)).map(function() { return null; });
        for (var i=0; i < normalColValues.length; i++) {
            pivotedRows.push(_.clone(emptyRow));
        }

        // fill it up with the data
        for (var j=0; j < data.rows.length; j++) {
            var normalColIdx = normalColValues.lastIndexOf(data.rows[j][normalCol]);
            var pivotColIdx = pivotColValues.lastIndexOf(data.rows[j][pivotCol]);

            pivotedRows[normalColIdx][0] = data.rows[j][normalCol];
            // NOTE: we are hard coding the expectation that the metric is in the 3rd column
            pivotedRows[normalColIdx][pivotColIdx] = data.rows[j][2];
        }

        // provide some column metadata to maintain consistency
        var cols = pivotColValues.map(function(val, idx) {
            if (idx === 0) {
                // first column is always the coldef of the normal column
                return data.cols[normalCol];
            }

            var colDef = _.clone(data.cols[pivotCol]);
            colDef['display_name'] = val || "";
            colDef['name'] = val || "";
            return colDef;
        });

        return {
            cols: cols,
            columns: pivotColValues,
            rows: pivotedRows
        };
    },

    distinctValues: function(data, colIdx) {
        var vals = data.rows.map(function(r) {
            return r[colIdx];
        });

        return vals.filter(function(v, i) { return i==vals.lastIndexOf(v); });
    },

    cardinality: function(data, colIdx) {
        return DataGrid.distinctValues(data, colIdx).length;
    }
};


export default DataGrid;
