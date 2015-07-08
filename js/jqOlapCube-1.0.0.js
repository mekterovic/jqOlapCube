/**
 * @author igor.mekterovic@fer.hr
 *
 * using:
 *    jQuery Plugin Boilerplate
 *    by Stefan Gabos
 */


(function ($) {

    "use strict";
    
    $.jqOlapCube = function (domElement, options) {

        // plugin's default options
        // this is private property and is  accessible only from inside the plugin
        var defaults = {
            // if your plugin is event-driven, you may provide callback capabilities
            // for its events. execute these functions before or after events of your
            // plugin, so that users may customize those particular events without
            // changing the plugin's code
            // onBeforeExecute: function (mdx) { },
            // onError: function(errorThrown, mdx) {}
        };

        // to avoid confusions, use "plugin" to reference the
        // current instance of the object
        var plugin = this;

        // this will hold the merged default, and user-provided options
        // plugin's properties will be available through this object like:
        // plugin.settings.propertyName from inside the plugin or
        // element.data('jqOlapCube').settings.propertyName from outside the plugin,
        // where "element" is the element the plugin is attached to;
        plugin.settings = {};

        var $element = $(domElement);    // reference to the jQuery version of DOM element
        // element  = domElement;    // reference to the actual DOM element

        // private methods
        // these methods can be called only from inside the plugin like:
        // methodName(arg1, arg2, ... argn)
        var onRows = [], onColumns = [], onFilter = [], onSort, currAxis;

        var removeDimFromAxis = function (huname, axis) {
            var index, val;
            for (index = 0; index < axis.length; ++index) {
                val = axis[index];
                if (val[0].huname === huname) {
                    axis.splice(index, 1);
                    return;
                }
            }
        };

        var addToAxis = function (qe, axis, pos, silent) {
            var val, index;
            if (axis === 'Col' || axis === 'Measure') {
                currAxis = onColumns;
            } else if (axis === "Row") {
                currAxis = onRows;
            } else if (axis === 'Filter') {
                currAxis = onFilter;
                if (!silent) {
                    removeDimFromAxis(qe.huname, onRows);
                    removeDimFromAxis(qe.huname, onColumns);
                }
            } else {
                window.alert('unknown axis');
                return;
            }
            for (index = 0; index < currAxis.length; ++index) {
                val = currAxis[index];
                if (val[0].isSameHierarchy(qe)) {
                    if (pos === undefined) val.push(qe);
                    else val.splice(pos, 0, qe);
                    break;
                }
            }
            if (!currAxis.length || index === currAxis.length)
                if (pos === undefined) currAxis.push([qe]);
                else currAxis.splice(pos, 0, [qe]);

            disableTreeElement(qe);


            if (!silent) checkRunQuery();

        };


        var disableTreeElement = function (qe) {
            if (qe.etype === 'Measure') {
                var node = treeDiv.find('li[uname="' + qe.uname + '"]');
                node.attr("rel", "disabledMeasure");
            } else {
                $.each(treeDiv.find('li[huname="' + qe.huname + '"]'), function (index, val) {
                    var etype = $(val).attr("etype");
                    if (etype === 'Level') $(val).attr("rel", "disabledLevel0" + $(val).attr("levelnumber"));  // to properly disable both Levels and Hierarchies
                    else $(val).attr("rel", "disabled" + etype);  // this is Hierarchy
                });
            }
        };
        var enableTreeElement = function (qe) {
            if (qe.etype === 'Measure') {
                var node = treeDiv.find('li[uname="' + qe.uname + '"]');
                node.attr("rel", node.attr("orel"));
            } else {
                $.each(treeDiv.find('li[huname="' + qe.huname + '"]'), function (index, val) {
                    $(val).attr("rel", $(val).attr("orel"));
                });
            }
        };

        var toggleDrillState = function (qe) {
            $.each([onRows, onColumns], function (index, dims) {
                for (var i = 0; i < dims.length; ++i) {
                    if (dims[i][0].isSameHierarchy(qe)) {
                        dims[i][0].toggleDrillMember(qe);
                        return false;
                    }
                }
            });

            checkRunQuery();
        };

        var removeFromFilter = function (qe) {
            if (qe.isHierarchy()) {
                $.each(onFilter, function (i, hierMembers) {
                    if (hierMembers[0].isSameHierarchy(qe)) {
                        onFilter.splice(i, 1);
                        return false;
                    }
                });
                enableTreeElement(qe);
            } else {
                for (var i = 0; i < onFilter.length; ++i) {
                    if (onFilter[i][0].isSameHierarchy(qe)) {
                        if (onFilter[i].length === 1) {  // last member of the hierarchy
                            qe.etype = 'Hierarchy';
                            removeFromFilter(qe);
                            return;
                        }
                        for (var filti = 0; filti < onFilter[i].length; filti++) {
                            if ((onFilter[i])[filti].uname === qe.uname) {
                                onFilter[i].splice(filti, 1);
                                break;
                            }
                        }

                        // $.each(onFilter[i], function (index, value) {
                        //     if (value.uname === qe.uname) {
                        //         onFilter[i].splice(index, 1);
                        //         return false;
                        //     }
                        // });
                    }
                }
            }
            checkRunQuery();
        };
        var removeFromQuery = function (qe) {
            if (qe.isHierarchy()) {
                var found = false;
                $.each([onRows, onColumns], function (index, currAxis) {
                    $.each(currAxis, function (i, hierMembers) {
                        if (hierMembers[0].isSameHierarchy(qe)) {
                            currAxis.splice(i, 1);
                            found = true;
                            return false;
                        }
                    });
                    if (found) return false;
                });
                enableTreeElement(qe);
            } else if (qe.isMeasure()) {
                $.each(onColumns[onColumns.length - 1], function (index, currMeasure) {
                    if (currMeasure.uname === qe.uname) {
                        onColumns[onColumns.length - 1].splice(index, 1);
                        return false;
                    }
                });
                enableTreeElement(qe);

                if (onColumns[onColumns.length - 1].length === 0) onColumns.length = onColumns.length - 1;  // have removed last Measure, so drop the dim Measure
            } else {
                $.each([onRows, onColumns], function (index, currAxis) {
                    $.each(currAxis, function (i, hierMembers) {
                        if (hierMembers[0].isSameHierarchy(qe)) {
                            hierMembers[0].addExceptMember(qe);
                            return false; // TODO
                        }
                    });
                });
            }
            checkRunQuery();
        };

        var updateFilterPane = function () {
            var filterHtml = '';
            $.each(onFilter, function (index, val) {
                var filtMembers = [];
                $.each(val, function (i, memb) {
                    filtMembers.push('<span class="jqOlapCube-filterMember" ' + memb.toHtml() + '>' + memb.caption + '</span>');
                });
                filterHtml += '<div class="jqOlapCube-filterHierarchy" ' + val[0].toHtml() + '> <b>' + val[0].huname + '</b>:&nbsp;' + filtMembers.join(', ') + '</div>';
            });
            filterDiv.html(filterHtml === '' ? $.jqOlapCube.i18n.Filter.DropCaption : filterHtml);
            filterDiv.find('.jqOlapCube-filterHierarchy').attr("etype", "Hierarchy");
            filterDiv.find('.jqOlapCube-filterHierarchy, .jqOlapCube-filterMember').attr("from", "Filter").draggable(
                {
                    helper: 'clone',
                    start: function () {
                        garbageDiv.css("left", $(this).offset().left + 200)
                                  .css("top", $(this).offset().top + 100);
                        garbageDiv.show();
                    },
                    stop: function () {
                        garbageDiv.hide();
                    }
                }
            );
        };



        var getMdx = function () {
            // build MDX
            var mdx = 'SELECT';
            var arrDims = [];
            $.each(onColumns, function (index, val) {
                var arrMembers = [];
                $.each(val, function (i, memb) {
                    arrMembers.push(memb.getMembersExpression());
                });
                arrDims.push('{' + arrMembers.join(',') + '}');
            });
            mdx += '\n\tNon Empty {' + arrDims.join('*') + '} ON Columns, ';
            arrDims = [];
            $.each(onRows, function (index, val) {
                var arrMembers = [];
                $.each(val, function (i, memb) {
                    arrMembers.push(memb.getMembersExpression());
                });
                arrDims.push('{' + arrMembers.join(',') + '}');
            });
            if (onSort === undefined) {
                mdx += '\n\tNon Empty {' + arrDims.join('*') + '} ON Rows ';
            } else {
                mdx += '\n\tNon Empty Order({' + arrDims.join('*') + '}, ' + (onSort.member.isMeasure() ? onSort.member.uname : onSort.member.huname + '.CurrentMember.Name') + ',' + onSort.type + ') ON Rows ';
            }

            mdx += '\nFrom ' + plugin.settings.FormattedCubeName;
            if (onFilter.length > 0) {
                var arrWith = [], arrWhere = []; //, filterHtml = '';
                $.each(onFilter, function (index, val) {
                    var arrMembers = [];
                    $.each(val, function (i, memb) {
                        arrMembers.push(memb.uname);
                    });
                    var aggName = val[0].huname + '.[Filter members from ' + val[0].huname.replace(/\]/g, '').replace(/\[/g, '') + ']';
                    arrWith.push('MEMBER ' + aggName + ' AS ' + "'Aggregate({" + arrMembers.join(',') + "})'");
                    arrWhere.push(aggName);
                });
                mdx = 'WITH \n\t' + arrWith.join('\n\t') + "\n" + mdx + '\nWHERE (\n\t' + arrWhere.join(",\n\t") + '\n)';
                //filterDiv.html(filterHtml);
            }
            return mdx;
        };

        var checkRunQuery = function () {
            garbageDiv.hide();  // to sweep under the carpet the jquery.ui bug: "Uncaught TypeError: Cannot read property 'options' of undefined" // otherwise, g.can remains visible when query becomes not runnable (last dim memb to filter)
            updateFilterPane();
            if (onRows.length > 0 && onColumns.length > 0) {
                var mdx = getMdx();
                if (mdx.indexOf('[Measures].') > 0) {
                    executeMdx(mdx);
                    enableButtons();
                    return true;
                } //else {
                //return false; // I do not allow for 'default Measure'
                //}

            } else {
                rTable.setResult(undefined); // When the last dim members (on an axis) is moved to the filter
            }
            tableDiv.html(rTable.getHtml(onColumns, onRows, onSort));        // This will update empty table. Full table will update itself asycnronously (onSuccess)
            disableButtons();
            return false;
        };

        var enableButtons = function () {
            btnSnD.removeAttr('disabled');
            btnOrderBy.removeAttr('disabled');
            if (btnCsv) btnCsv.removeAttr('disabled');
            if (btnSaveMdx) btnSaveMdx.removeAttr('disabled');
        };

        var disableButtons = function () {
            btnSnD.attr('disabled', 'disabled');
            btnOrderBy.attr('disabled', 'disabled');
            if (btnCsv) btnCsv.attr('disabled', 'disabled');
            if (btnSaveMdx) btnSaveMdx.attr('disabled', 'disabled');
        };

        var onSuccessInitDimTree = function (data) {
            var i;
            statusDiv.html($.jqOlapCube.i18n.Toolbar.ReadyCaption);
            if ($.jqOlapCube.i18n.General.Measures !== "Measures" && data && data.Dimensions) {
                for (i = 0; i < data.Dimensions.length; ++i) {
                    if (data.Dimensions[i].data === "Measures") {
                        data.Dimensions[i].data = $.jqOlapCube.i18n.General.Measures;
                        break;
                    }
                }
            }
            var jsFileLocation = $('script[src*=jqOlapCube]')
                                 .filter(function () {
                                     return this.src.match(/jqOlapCube-(\d\.)*\w*\.?js/i);
                                 }).attr('src');  // the js file path
            jsFileLocation = jsFileLocation.replace(/jqOlapCube-(\d\.)*\w*\.?js/i, '');  // the js folder path
            $(treeDiv).jstree({
                "json_data": {
                    "data": data.Dimensions
                },
                "crrm": {
                    "move": {
                        "check_move": function () {
                            return false;
                        }
                    }
                },
                "dnd": {
                    "drop_finish": function (data) {
                        var qe = new QueryElement(data.o);
                        if (data.r.closest('[axis]').attr("axis") === 'Filter') {
                            if (qe.isLevel()) {
                                getFilterLevelMembers(qe.uname);
                            } else {
                                window.alert('You can drop only Levels from dim tree to filter.');
                            }
                        } else {
                            addToAxis(qe, data.r.closest('[axis]').attr("axis"), data.r.closest('[axis]').attr("pos")); // (data.r.attr("pos") === undefined) ? 0 : data.r.attr("pos")
                        }
                    }
                },
                types: {
                    "types": {
                        // the default type
                        "measures": {
                            "icon": { "image": jsFileLocation + "/css/measures.png" },
                            "select_node": function (e) { this.toggle_node(e); return false; }
                        },
                        "dimension": {
                            "select_node": function (e) { this.toggle_node(e); return false; },
                            "icon": { "image": jsFileLocation + "/css/dimension.png" }
                        },
                        "hierarchy": {
                            "select_node": function (e) { this.toggle_node(e); return false; },
                            "icon": { "image": jsFileLocation + "/css/hierarchy.png" }
                        },
                        "level00": { "icon": { "image": jsFileLocation + "/css/level00.png" } },
                        "level01": { "icon": { "image": jsFileLocation + "/css/level01.png" } },
                        "level02": { "icon": { "image": jsFileLocation + "/css/level02.png" } },
                        "level03": { "icon": { "image": jsFileLocation + "/css/level03.png" } },
                        "level04": { "icon": { "image": jsFileLocation + "/css/level04.png" } },
                        "level05": { "icon": { "image": jsFileLocation + "/css/level05.png" } },
                        "level06": { "icon": { "image": jsFileLocation + "/css/level06.png" } },
                        "level07": { "icon": { "image": jsFileLocation + "/css/level07.png" } },
                        "level08": { "icon": { "image": jsFileLocation + "/css/level08.png" } },
                        "level09": { "icon": { "image": jsFileLocation + "/css/level09.png" } },
                        "level10": { "icon": { "image": jsFileLocation + "/css/level10.png" } },
                        "measure": {
                            "icon": { "image": jsFileLocation + "/css/measure.png" }
                        },
                        "disabledMeasure": {
                            "drag_start": false,  // this flag does not work
                            "select_node": false,
                            "open_node": false,
                            "close_node": false,
                            "icon": { "image": jsFileLocation + "/css/measure-g.png" }
                        },
                        "disabledHierarchy": {
                            "drag_start": false,  // this flag does not work
                            "select_node": false,
                            "open_node": false,
                            "close_node": false,
                            "icon": { "image": jsFileLocation + "/css/hierarchy-g.png" }
                        },
                        "disabledLevel00": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level00-g.png" } },
                        "disabledLevel01": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level01-g.png" } },
                        "disabledLevel02": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level02-g.png" } },
                        "disabledLevel03": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level03-g.png" } },
                        "disabledLevel04": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level04-g.png" } },
                        "disabledLevel05": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level05-g.png" } },
                        "disabledLevel06": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level06-g.png" } },
                        "disabledLevel07": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level07-g.png" } },
                        "disabledLevel08": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level08-g.png" } },
                        "disabledLevel09": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level09-g.png" } },
                        "disabledLevel10": { "select_node": false, "open_node": false, "close_node": false, "icon": { "image": jsFileLocation + "/css/level10-g.png" } }
                    }
                },
                "themes": {
                    "theme": "jqOlapCube"
                },
                "callback": {   // various callbacks to attach custom logic to

                    beforemove: function (/* NODE, REF_NODE, TYPE, TREE_OBJ */) {
                        $(".jstree-drop").css("background", "lime");
                        $(".jstree-drop").css("border", "5px solid green");
                        return true;
                    }
                },
                "core": { "animation": 100 },
                "plugins": ["themes", "json_data", "ui", "dnd", "crrm", "types"]
            }).bind("loaded.jstree", function () {
                treeDiv.find("li").each(function () {
                    $(this).addClass('jstree-draggable');
                    if ($(this).attr("etype") === 'Dimension' && $(this).attr("uname").toLowerCase().indexOf('measures') >= 0) $(this).attr("rel", "measures");
                    else if ($(this).attr("etype") === 'Dimension') $(this).attr("rel", "dimension");
                    else if ($(this).attr("etype") === 'Hierarchy') $(this).attr("rel", "hierarchy");
                    else if ($(this).attr("etype") === 'Level') $(this).attr("rel", "level0" + $(this).attr("levelnumber"));
                    else if ($(this).attr("etype") === 'Measure') $(this).attr("rel", "measure");
                });
                treeDiv.find("[rel]").each(function () {
                    $(this).attr("orel", $(this).attr("rel"));
                });
            }).bind("dblclick.jstree", function (event) {
                var node = $(event.target).closest("li");
                if (node.attr("rel").indexOf("disabled") !== 0 && "|Hierarchy|Level|Measure".indexOf(node.attr("etype")) > 0)
                    addToAxis(new QueryElement(node), (node.attr("etype") === 'Measure') ? "Measure" : "Row");

            });

            $(document).bind("drag_start.vakata", function (e, data) {
                if (data.data.jstree && $(data.data.obj[0]).attr("rel").indexOf("disabled") !== 0 && "|Hierarchy|Level|Measure".indexOf($(data.data.obj[0]).attr("etype")) > 0) {
                    if ($(data.data.obj[0]).attr("etype") === 'Measure') {
                        rightDiv.find(".jqOlapCube-drag-measure-off").each(function () {
                            $(this).addClass('jqOlapCube-drag-measure-on').removeClass('jqOlapCube-drag-measure-off').addClass('jstree-drop');
                        });
                        rightDiv.find("[expndmcs]").each(function () {
                            $(this).attr("colspan", $(this).attr("expndmcs"));
                        });
                        rightDiv.find('*[class^="ResultField"]').each(function () {
                            $(this).attr("colspan", 2);
                        });
                        rightDiv.find("tr").find("td:last").each(function () {
                            if ($(this).attr("class") !== undefined && $(this).attr("class").indexOf("ResultField") != -1) $(this).attr("colspan", 3);
                        });

                    } else { //if (/*$(data.data.obj[0]).attr("etype") === 'Dimension' ||*/ $(data.data.obj[0]).attr("etype") === 'Hierarchy' || $(data.data.obj[0]).attr("etype") === 'Level')
                        rightDiv.find(".jqOlapCube-drag-col-off, .jqOlapCube-drag-row-off ").each(function () {
                            if ($(this).hasClass('jqOlapCube-drag-col-off')) $(this).addClass('jqOlapCube-drag-col-on').removeClass('jqOlapCube-drag-col-off').addClass('jstree-drop');
                            else $(this).addClass('jqOlapCube-drag-row-on').removeClass('jqOlapCube-drag-row-off').addClass('jstree-drop');
                        });
                        rightDiv.find("[expndcs]").each(function () {
                            $(this).attr("colspan", $(this).attr("expndcs"));
                        });
                        rightDiv.find("[expndrs]").each(function () {
                            $(this).attr("rowspan", $(this).attr("expndrs"));
                        });
                        if ($(data.data.obj[0]).attr("etype") === 'Level') filterDiv.addClass('drag-on');
                    }

                } else {
                    $.vakata.dnd.drag_stop();
                }
            });
            $(document).bind("drag_stop.vakata", function (e, data) {
                // this fires even on collapse/expand, why!?
                if ($.vakata.dnd.is_drag && data.data.jstree && $(data.data.obj[0]).attr("rel").indexOf("disabled") !== 0) {
                    rightDiv.find(".jqOlapCube-drag-measure-on").each(function () {
                        $(this).addClass('jqOlapCube-drag-measure-off').removeClass('jqOlapCube-drag-measure-on').removeClass('jstree-drop');
                    });
                    rightDiv.find(".jqOlapCube-drag-col-on").each(function () {
                        $(this).addClass('jqOlapCube-drag-col-off').removeClass('jqOlapCube-drag-col-on').removeClass('jstree-drop');
                    });
                    rightDiv.find(".jqOlapCube-drag-row-on").each(function () {
                        $(this).addClass('jqOlapCube-drag-row-off').removeClass('jqOlapCube-drag-row-on').removeClass('jstree-drop');
                    });
                    rightDiv.find("[expndcs]").each(function () {
                        $(this).attr("colspan", $(this).attr("clpscs"));
                    });
                    rightDiv.find("[expndrs]").each(function () {
                        $(this).attr("rowspan", $(this).attr("clpsrs"));
                    });
                    rightDiv.find("[expndmcs]").each(function () {
                        $(this).attr("colspan", $(this).attr("clpscs"));
                    });
                    rightDiv.find('td[class^="ResultField"]').attr("colspan", 1);
                }
                filterDiv.removeClass('drag-on');
            });
        };

        var onError = function (jqXHR, textStatus, errorThrown) {
            statusDiv.addClass("jqOlapCube-err");
            statusDiv.html($.jqOlapCube.i18n.Toolbar.ErrorOccurred);
            if (plugin.settings.onError !== undefined) plugin.settings.onError(errorThrown, getMdx());
        };

        var onComplete = function () {
            $(".jqOlapCube-spinner").hide();
            tableDiv.fadeTo(0, 1);
        };

        var initDimensionTree = function () {
            $.ajax({
                url: plugin.settings.DiscoverMetadataURL,
                type: "GET",
                data: { "cubeName": plugin.settings.CubeName },
                cache: false, //because of IE
                success: onSuccessInitDimTree,
                error: onError,
                complete: onComplete,
                dataType: "json"
            });
        };

        var getFilterLevelMembers = function (levelName) {
            statusDiv.html('Retrieving level members ...');
            $(".jqOlapCube-spinner").show();
            $.ajax({
                url: plugin.settings.DiscoverLevelMembersURL,
                type: "GET",
                data: { cubeName: plugin.settings.CubeName, levelName: levelName },
                cache: false, //because of IE
                success: onSuccessGetFilterLevelMembers,
                error: onError,
                complete: onComplete,
                dataType: "json"
            });
        };

        var onSuccessGetFilterLevelMembers = function (data) {
            statusDiv.html("");
            var modal = $('<div class="jqOlapCubeFilterModalPane" title="' + $.jqOlapCube.i18n.Filter.SelectMembersTitle + '"></div>', {});
            modal.html('<button id="filterSelectAllButton">' + $.jqOlapCube.i18n.Filter.SelectMembersAll + '</button>' +
                       '    <button id="filterSelectNoneButton">' + $.jqOlapCube.i18n.Filter.SelectMembersNone + '</button>' +
                       '    <div id="jqOlapCube-filterMemberList" class="jqOlapCube-filterMemberList"></div>' +
                       '    <div style="text-align:center;">' +
                       '        <button id="filterOK">' + $.jqOlapCube.i18n.Filter.SelectMembersOK + '</button>' +
                       '        <button id="filterCancel">' + $.jqOlapCube.i18n.Filter.SelectMembersCancel + '</button>' +
                       '    </div>');

            $.each(data.Members, function (index, value) {
                modal.find('#jqOlapCube-filterMemberList').append('<input type="checkbox"' + (new QueryElement($(value))).toHtml() + ' />&nbsp;' + value.caption + '<br/>');
            });
            modal.find("#filterSelectAllButton").click(function () {
                modal.find("input[type=checkbox]").attr("checked", "true");
            });
            modal.find("#filterSelectNoneButton").click(function () {
                modal.find("input[type=checkbox]").removeAttr("checked");
            });

            modal.find('#filterOK').click(function () {


                $.each(modal.find("input[type=checkbox]"), function (index, val) {
                    if ($(val).is(':checked')) addToAxis(new QueryElement($(val)), "Filter", undefined, true);
                });
                modal.dialog("close");
                checkRunQuery();
            });

            modal.find('#filterCancel').click(function () {
                modal.dialog("close");
            });

            modal.dialog({
                width: 500,
                modal: true
            });
        };

        var executeMdx = function (mdx) {
            if (plugin.settings.onBeforeExecute !== undefined) plugin.settings.onBeforeExecute(mdx);
            statusDiv.html($.jqOlapCube.i18n.Toolbar.ExecutingCaption);
            $(".jqOlapCube-spinner").show();
            tableDiv.fadeTo('fast', 0.5);

            $.ajax({
                url: plugin.settings.ExecuteURL,
                type: "POST",
                data: { "mdx": mdx },
                cache: false, //zbog IE
                success: onExecuteSuccess,
                error: onError,
                complete: onComplete,
                dataType: "json"
            });
        };

        var onExecuteSuccess = function (data) {
            statusDiv.html('Query succesfully executed, formatting results...');
            rTable = new ResultTable(data);
            tableDiv.html(rTable.getHtml(onColumns, onRows, onSort));
            if (data.Status === "OK") {
                statusDiv.html("&nbsp;|&nbsp;" + rTable.result.axisInfo[1].positions.length + "&nbsp;x&nbsp;" + rTable.result.axisInfo[0].positions.length + "&nbsp|&nbsp;" + $.jqOlapCube.i18n.Toolbar.ReadyCaption);
                if (rTable.hasCells) {
                    tableDiv.find('[uname]').draggable(
                        {
                            helper: 'clone',
                            start: function () {
                                garbageDiv.css("left", $(this).offset().left + 200)
                                          .css("top", $(this).offset().top + 100);
                                garbageDiv.show();
                            },
                            stop: function () {
                                garbageDiv.hide();
                            }
                        }
                    );
                    tableDiv.find('[etype=Member]').dblclick(function (eventObject) {
                        var data = $(eventObject.target);
                        toggleDrillState(new QueryElement(data));
                    });



                    visSettings.data = data;
                    if (visSettings.enabled) {
                        visualiseData(data);
                    }


                }
            } else if (data.Status === "Error") {
                statusDiv.html($.jqOlapCube.i18n.Toolbar.ErrorOccurred);
                plugin.settings.onError(data.Message, getMdx());
            }
        };



		
        var btnSnD, btnOrderBy;
        var rTable;
        var leftDiv, rightDiv, treeDiv, filterDiv, tableDiv, statusDiv, garbageDiv, toolbarDiv, btnCsv, btnSaveMdx;

        // the "constructor" method that gets called when the object is created
        plugin.init = function () {

            // the plugin's final properties are the merged default and
            // user-provided options (if any)
            plugin.settings = $.extend({}, defaults, options);

            initialiseVisSettings();
            var api = {
                TreeMapNode: TreeMapNode,
                PrepareData: prepareData
            };

            $.jqOlapCube.testing = api;










            if (plugin.settings.CubeName.charAt(0) === '[') {
                plugin.settings = $.extend({}, plugin.settings, { "FormattedCubeName": plugin.settings.CubeName });
            } else {
                plugin.settings = $.extend({}, plugin.settings, { "FormattedCubeName": '[' + plugin.settings.CubeName + ']' });
            }

            initDimensionTree(plugin.settings.CubeName);

            rTable = new ResultTable();

            // Setup initial elements:
            $element.html('');
            $element.addClass("jqOlapCubeMaster");


            treeDiv = $('<div/>', {});
            leftDiv = $('<div/>', {}).append('<div class="jqOlapCube-dimTreeHeader">' + plugin.settings.CubeName + '</div>').append(treeDiv).appendTo($element);

            filterDiv = $('<div axis="Filter" class="jqOlapCube-filterPane jstree-drop"></div>', {});
            tableDiv = $('<div/>', {});
            toolbarDiv = $('<div class="jqOlapCube-toolbar"></div>', {});

            garbageDiv = $('<div class="jqOlapCube-garbageDiv">&nbsp;</div>', {});






            rightDiv = $('<div/>', {}).append(toolbarDiv).append(filterDiv).append(tableDiv).append(garbageDiv).appendTo($element);

            garbageDiv.hide();

            statusDiv = $('<div class="jqOlapCube-statusBar">' + $.jqOlapCube.i18n.Toolbar.PopulatingCaption + '</div>', {});
            var btnToggle = $("<button/>", {
                "class": "jqOlapCube-toggledimtree-button",
                "text": "",
                "click": function () { leftDiv.toggle("slow"); $(this).toggleClass("jqOlapCube-toggledimtree-button-off"); }
            });
            toolbarDiv.append(btnToggle);

            var btnToggleVis = $("<button/>", {
                "class": "jqOlapCube-togglevis-button",
                "text": "",
                "click": function () {
                    $("svg").fadeToggle("slow", "linear");
                    $(this).toggleClass("jqOlapCube-togglevis-button-off");
                    visSettings.enabled = (!visSettings.enabled);
                    if (visSettings.enabled) visualiseData(visSettings.data);

                }
            });
            toolbarDiv.append(btnToggleVis);

          


            var btnNextVis = $("<button/>", {
                "class": "jqOlapCube-nextvis-button",
                "text": "",
                "click": function () {
                    if (visSettings.enabled) {
                        var graphs = null;
                        var graphs = new Array();


                        var graphLabels = null;
                        var graphLabels = new Array();
                        switch (visSettings.dimensions) {
                        
                            case "00":
                                break;
                            case "01":                                                
                                var bar = $('<input type="checkbox" id="BarCheck" value="Bar">');
                                var pie = $('<input type="checkbox" id="PieCheck" value="Pie">');
                                var line = $('<input type="checkbox" id="LineCheck" value="Line">');
                                graphs.push(bar);
                                graphs.push(line);
                                graphs.push(pie);

                                graphLabels.push("Bar chart");
                                graphLabels.push("Line chart");
                                graphLabels.push("Pie chart");
 
                                for (var i = 0; i < visSettings.d1bool.length; i++) {
                                    graphs[i].prop('checked', visSettings.d1bool[i]);
                                }                          
                               break;
                            case "02":
                                var stackedBar = $('<input type="checkbox" id="StackedBarCheck" value="StackedBar">');
                                var line = $('<input type="checkbox" id="MultiLineCheck" value="mLine">');
                                var heat = $('<input type="checkbox" id="HeatCheck" value="Heat">');
                                var tree = $('<input type="checkbox" id="TreeCheck" value="Tree">')
                                var parallel = $('<input type="checkbox" id="ParallelCheck" value="Parallel">')
                                graphs.push(stackedBar);
                                graphs.push(line);
                                graphs.push(heat);
                                graphs.push(tree);
                                graphs.push(parallel);
                                graphLabels.push("Bar chart");
                                graphLabels.push("Line chart");
                                graphLabels.push("Heatmap");
                                graphLabels.push("Treemap");
                                graphLabels.push("Parallel coordinates");

                                for (var i = 0; i < visSettings.d2bool.length; i++) {
                                    graphs[i].prop('checked', visSettings.d2bool[i]);
                                }

                                break;
                            case "11":
                                var stackedBar = $('<input type="checkbox" id="StackedBarCheck" value="StackedBar">');
                                var line = $('<input type="checkbox" id="MultiLineCheck" value="mLine">');
                                var heat = $('<input type="checkbox" id="HeatCheck" value="Heat">');
                                var tree = $('<input type="checkbox" id="TreeCheck" value="Tree">')
                                var parallel = $('<input type="checkbox" id="ParallelCheck" value="Parallel">')
                                graphs.push(stackedBar);
                                graphs.push(line);
                                graphs.push(heat);
                                graphs.push(tree);
                                graphs.push(parallel);
                                graphLabels.push("Bar chart");
                                graphLabels.push("Line chart");
                                graphLabels.push("Heatmap");
                                graphLabels.push("Treemap");
                                graphLabels.push("Parallel coordinates");

                                for (var i = 0; i < visSettings.d2bool.length; i++) {
                                    graphs[i].prop('checked', visSettings.d2bool[i]);
                                }
                                break;
                        
                            default:
                                var heat = $('<input type="checkbox" id="HeatCheck" value="Heat">');
                                var tree = $('<input type="checkbox" id="TreeCheck" value="Tree">')
                                var parallel = $('<input type="checkbox" id="ParallelCheck" value="Parallel">')
                                graphs.push(tree);
                                graphs.push(parallel);
                                graphs.push(heat);
                                graphLabels.push("Treemap");
                                graphLabels.push("Parallel coordinates");
                                graphLabels.push("Heatmap");


                                for (var i = 0; i < visSettings.dbool.length; i++) {
                                    graphs[i].prop('checked', visSettings.dbool[i*2]);
                                }
                                break;

                        }
                        // Define the Dialog and its properties.

                        $("#dialog-confirm").dialog({
                            resizable: false,
                            modal: true,
                            title: "Charts",
                            height: 250,
                            width: 400,
                            create: function (e, ui) {



                            },
                            open: function () {
                                var pane = $(this);
                                while (pane[0].firstChild) {
                                    pane[0].removeChild(pane[0].firstChild);
                                }
                                for (var i = 0; i < graphs.length; i++) {
                                    var checkBox = $("<label>" + graphLabels[i] + "</label><br>");
                                    checkBox.append(graphs[i]);
                                    pane.append(checkBox);
                                }
                                switch (visSettings.dimensions) {

                                    case "00":
                                        break;
                                    case "01":
                                        for (var i = 0; i < visSettings.d1bool.length; i++) {
                                            var checkBox = $(this)[0].children[i*2].children[0];
                                            checkBox.checked = visSettings.d1bool[i];
                                        }
                                        break;
                                    case "02":
                                        for (var i = 0; i < visSettings.d2bool.length; i++) {
                                            var checkBox = $(this)[0].children[i*2].children[0];
                                            checkBox.checked = visSettings.d2bool[i];
                                        }
                                        break;

                                    case "11":
                                        for (var i = 0; i < visSettings.d2bool.length; i++) {
                                            var checkBox = $(this)[0].children[i * 2].children[0];
                                            checkBox.checked = visSettings.d2bool[i];
                                        }
                                        break;

                                    default:
                                        for (var i = 0; i < visSettings.dbool.length; i++) {
                                            var checkBox = $(this)[0].children[i * 2].children[0];
                                            checkBox.checked = visSettings.dbool[i];
                                        }
                                        break;
                                }

                            },
                            buttons: {
                                "Ok": function () {
                                    switch (visSettings.dimensions) {

                                        case "00":
                                            break;
                                        case "01":
                                            for (var i = 0; i < visSettings.d1bool.length; i++) {
                                                var checkBox = $(this)[0].children[i*2].children[0];
                                                visSettings.d1bool[i] = checkBox.checked;
                                            }
                                            break;
                                        case "02":
                                            for (var i = 0; i < visSettings.d2bool.length; i++) {
                                                var checkBox = $(this)[0].children[i*2].children[0];
                                                visSettings.d2bool[i] = checkBox.checked;
                                            }
                                            break;

                                        case "11":
                                            for (var i = 0; i < visSettings.d2bool.length; i++) {
                                                var checkBox = $(this)[0].children[i * 2].children[0];
                                                visSettings.d2bool[i] = checkBox.checked;
                                            }
                                            break;

                                        default:
                                            for (var i = 0; i < visSettings.dbool.length; i++) {
                                                var checkBox = $(this)[0].children[i * 2].children[0];
                                                visSettings.dbool[i] = checkBox.checked;
                                            }
                                            break;
                                    }
                                    $(this).dialog('close');
                                    if (visSettings.data) visualiseData(visSettings.data);

                                },
                                "Cancel": function () {
                                    $(this).dialog('close');

                                }
                            }
                        });


                    
                    }
                }
            });
  
            toolbarDiv.append(btnNextVis);
            var btnLoadPreset = $("<button/>", {
                "class": "jqOlapCube-preset-button",
                "text": "",
                "click": function () {
                    presetDialog();




                }
            });
            toolbarDiv.append(btnLoadPreset);

            btnSnD = $("<button/>", {
                "class": "jqOlapCube-snd-button",
                "text": "",
                "click": function () {
                    var modal = $('<div class="jqOlapCubeSliceAndDice" title="' + $.jqOlapCube.i18n.SliceAndDice.Title + '"></div>', {});
                    modal.html(
                                  '    <table id="jqOlapCubeReorder" style="height:80%; width:100%;  background-color : #E0E0E0; border-collapse: collapse;">' +
                                  '        <tr style="width: 100%; ">' +
                                  '            <td style="width: 50%;  background-color : #E0E0E0; text-align:center; border-right: 2px solid;" rowspan="2">' +
                                  '                <div id="garbageDiv" class="jqOlapCube-garbageDiv"  style="margin: 0 auto; position:relative; "><span id="garbageDivCounter">&nbsp;</span></div>' +
                                  '            </td>' +
                                  '            <td style="width: 50%;">' +
                                  '            <div>' +
                                  '                <div id="jqOlapCube-snd-sortablecols" class="jqOlapCubeReorderConnectedSortable"> &nbsp;' +
                                  '                </div>' +
                                  '            </div>' +
                                  '            </td>' +
                                  '        </tr>' +
                                  '        <tr>' +
                                  '            <td style="width: 50%; border-top: 2px dashed;">' +
                                  '            <div>' +
                                  '                <div id="jqOlapCube-snd-sortablemeasures">' +
                                  '                </div>' +
                                  '            </div>' +
                                  '            </td>' +
                                  '        </tr>' +
                                  '        <tr style="width: 100%;">' +
                                  '            <td style="width: 50%; border-top: 2px solid;">' +
                                  '            <div class="demo" style="float: right">' +
                                  '                <div id="jqOlapCube-snd-sortablerows" class="jqOlapCubeReorderConnectedSortable"> <br/>' +
                                  '                </div>' +
                                  '            </div>  ' +
                                  '            </td>' +
                                  '            <td style="width: 50%; height:100%; border-top: 2px solid; border-left: 2px solid; background-color: white;">' +
                                  '            </td> ' +
                                  '        </tr>' +
                                  '    </table>' +
                                  '    <div style="text-align: center; margin-top: 30px;">' +
                                  '        <button id="jqOlapCube-snd-apply">' + $.jqOlapCube.i18n.SliceAndDice.Apply + '</button>' +
                                  '        <button id="jqOlapCube-snd-cancel">' + $.jqOlapCube.i18n.SliceAndDice.Close + '</button>     ' +
                                  '    </div>');
                    var i;
                    for (i = 0; i < onColumns.length - 1; ++i) {
                        modal.find("#jqOlapCube-snd-sortablecols").append('<div class="draggable jqOlapCube-snd-col" ' + onColumns[i][0].toHtml() + ' axis="Col" pos="' + i + '">' + onColumns[i][0].caption + '</div> ');
                    }
                    for (i = 0; i < onColumns[onColumns.length - 1].length; ++i) {
                        modal.find("#jqOlapCube-snd-sortablemeasures").append('<div class="draggable jqOlapCube-snd-measure" ' + onColumns[onColumns.length - 1][i].toHtml() + ' axis="Measure" pos="' + i + '">' + onColumns[onColumns.length - 1][i].caption + '</div> ');
                    }
                    for (i = 0; i < onRows.length; ++i) {
                        modal.find("#jqOlapCube-snd-sortablerows").append('<div class="draggable jqOlapCube-snd-row" ' + onRows[i][0].toHtml() + ' axis="Row" pos="' + i + '">' + onRows[i][0].caption + '</div> ');
                    }


                    modal.find(".jqOlapCubeReorderConnectedSortable").sortable({
                        connectWith: ".jqOlapCubeReorderConnectedSortable"
                    }).disableSelection();

                    modal.find("#jqOlapCube-snd-sortablemeasures").sortable();

                    modal.find('#garbageDiv').droppable({
                        accept: "[axis][pos]",
                        hoverClass: "jqOlapCube-gcan-hover",
                        drop: function (event, ui) {
                            var a = $(ui.draggable[0]).attr("axis");
                            var p = $(ui.draggable[0]).attr("pos");
                            modal.find("[axis=" + a + "][pos=" + p + "]").remove();
                            $(this).append($(ui.draggable[0]).clone());
                            $(this).find("div").hide();
                            var num = $(this).find("div").size();
                            $(this).find("#garbageDivCounter").html(num > 0 ? num : '');
                        }
                    });

                    modal.find('#jqOlapCube-snd-apply').click(function () {
                        var tmpOnCols = [], tmpOnRows = [];

                        $.each(modal.find("#jqOlapCube-snd-sortablecols").find("div"), function (index, val) {
                            if ($(val).attr("axis") === "Col") tmpOnCols.push(onColumns[$(val).attr("pos")]);
                            else tmpOnCols.push(onRows[$(val).attr("pos")]);
                            $(val).attr("axis", "Col").attr("pos", index);
                        });
                        $.each(modal.find("#jqOlapCube-snd-sortablerows").find("div"), function (index, val) {
                            if ($(val).attr("axis") === "Col") tmpOnRows.push(onColumns[$(val).attr("pos")]);
                            else tmpOnRows.push(onRows[$(val).attr("pos")]);
                            $(val).attr("axis", "Row").attr("pos", index);
                        });
                        var tmpMeasures = [];
                        $.each(modal.find("#jqOlapCube-snd-sortablemeasures").find("div"), function (index, val) {
                            tmpMeasures.push(onColumns[onColumns.length - 1][$(val).attr("pos")]);
                            $(val).attr("pos", index);
                        });
                        if (tmpMeasures.length) tmpOnCols.push(tmpMeasures);
                        onColumns = (tmpOnCols.length) ? tmpOnCols : [];
                        onRows = (tmpOnRows.length) ? tmpOnRows : [];


                        $.each(modal.find("#garbageDiv").find("div"), function (index, val) {
                            enableTreeElement(new QueryElement($(val)));
                        });
                        modal.find("#garbageDiv").html('<span id="garbageDivCounter">&nbsp;</span>'); // remove all, a reset counter(display)

                        checkRunQuery();
                    });

                    modal.find('#jqOlapCube-snd-cancel').click(function () {
                        modal.dialog("close");
                    });

                    modal.dialog({
                        width: "70%",
                        modal: true
                    });


                }
            });
            toolbarDiv.append(btnSnD);
            btnSnD.attr('disabled', 'disabled');

            btnOrderBy = $("<button/>", {
                "class": "jqOlapCube-orderby-button",
                "text": "",
                "click": function () {
                    var modal = $('<div id="jqOlapCubeOrderPane" title="' + $.jqOlapCube.i18n.Order.Title + '">', {});
                    modal.html('<table style="width:100%; text-align:center; border: solid 1px black; border-collapse: collapse;" border="1">' +
                               '    <tr id="orderHeader"><th class="jqOlapCube-cheader">' + $.jqOlapCube.i18n.Order.OrderType + '</th><th id="orderNoneHeader" class="jqOlapCube-cheader">' + $.jqOlapCube.i18n.Order.None + '</th></tr>' +
                               '    <tr id="orderRadioButtons1" order="ASC"><td style="text-align:left;"><span class="jqOlapCube-order-sortASC"/>&nbsp;Ascending, hierarchical</td><td id="orderNoneCell" rowspan="4"><input type="radio" name="orderRBGroup" id="radioNone"></td></tr>' +
                               '    <tr id="orderRadioButtons2" order="DESC"><td style="text-align:left;"><span class="jqOlapCube-order-sortDESC"/>&nbsp;Descending, hierarchical</td></tr>' +
                               '    <tr id="orderRadioButtons3" order="BASC"><td style="text-align:left;"><span class="jqOlapCube-order-sortBASC"/>&nbsp;Ascending, non-hierarchical</td></tr>' +
                               '    <tr id="orderRadioButtons4" order="BDESC"><td style="text-align:left;"><span class="jqOlapCube-order-sortBDESC"/>&nbsp;Descending, non-hierarchical</td></tr>' +
                               '</table>' +
                               '<div style="text-align:center;">' +
                               '    <button id="orderOK">' + $.jqOlapCube.i18n.Order.Apply + '</button>' +
                               '    <button id="orderCancel">' + $.jqOlapCube.i18n.Order.Close + '</button>' +
                               '</div>');

                    var sortElements = [];
                    $.each(onRows, function (idx, h0) {
                        sortElements.push(h0[0]);
                    });
                    var sortElement = sortElements.concat(onColumns[onColumns.length - 1]);
                    $.each(sortElement, function (idx, qe) {
                        modal.find('#orderNoneHeader').before('<th class="jqOlapCube-cheader">' + qe.caption + '</th>');
                        modal.find('#orderNoneCell').before('<td><input type="radio" name="orderRBGroup" ' + qe.toHtml() + '></td>');
                        modal.find('tr[order][order!=ASC]').append('<td><input type="radio" name="orderRBGroup" ' + qe.toHtml() + '></td>');
                    });

                    if (onSort === undefined) modal.find("#radioNone").attr("checked", "checked");
                    else { // could not escape it like this? why? modal.find("input[uname=" + onSort.member.uname.replace(/\]/g, '\\]').replace(/\[/g, '\\[').replace(/\./g, '\\.').replace(/\ /g, '\\ ')).attr("checked", "checked");
                        $.each(modal.find("input[name=orderRBGroup]"), function (idx, val) {
                            if ($(val).attr("uname") === onSort.member.uname && $(val).closest("[order]").attr("order") === onSort.type) {
                                $(val).attr("checked", "checked");
                                return false;
                            }
                        });
                    }

                    modal.find('#orderOK').click(function () {
                        var selected = modal.find("input[name=orderRBGroup]:checked");
                        if (selected.length === 0 || $(selected[0]).attr("id") === "radioNone") {
                            onSort = undefined;
                        } else {
                            onSort = {
                                "member": new QueryElement($(selected[0])),
                                "type": $(selected[0]).closest('[order]').attr("order")
                            };
                        }
                        checkRunQuery();
                    });

                    modal.find('#orderCancel').click(function () {
                        modal.dialog("close");
                    });

                    modal.dialog({
                        width: "70%",
                        modal: true
                    });
                }
            });
            toolbarDiv.append(btnOrderBy);
            btnOrderBy.attr('disabled', 'disabled');
            if (plugin.settings.CsvURL) {
                btnCsv = $("<button/>", {
                    "class": "jqOlapCube-csv-button",
                    "text": "",
                    "click": function () {
                        // must append it to document, otherwise IE will not submit.
                        var form = document.createElement("form");
                        $(form).attr("action", plugin.settings.CsvURL)
                               .attr("method", "post")
                               .attr("target", "_top")
                               .append($('<input>', {
                                   'name': 'mdx',
                                   'value': getMdx(),
                                   'type': 'hidden'
                               }));
                        document.body.appendChild(form);
                        $(form).submit();
                        document.body.removeChild(form);
                    }
                });
                toolbarDiv.append(btnCsv);
                btnCsv.attr('disabled', 'disabled');
            }
            if (plugin.settings.SaveMdx) {
                var saveComplete = function (jqXHR) {
                    var r = $.parseJSON(jqXHR.responseText);
                    $('<div title="' + $.jqOlapCube.i18n.SaveMdx.Title + '"<p>' + $.jqOlapCube.i18n.General.Status + ': ' + r.Status + '<br>' + $.jqOlapCube.i18n.General.Message + ':' + r.Message + "</p></div>").dialog({
                        modal: true,
                        buttons: {
                            Ok: function () {
                                $(this).dialog("close");
                            }
                        }
                    });
                };
                btnSaveMdx = $("<button/>", {
                    "class": "jqOlapCube-savemdx-button",
                    "text": "",
                    "click": function (event) {
                        event.preventDefault();
                        if (plugin.settings.SaveMdx.Form === undefined) {
                            $.ajax({
                                url: plugin.settings.SaveMdx.URL,
                                type: "POST",
                                data: { "mdx": getMdx() },
                                cache: false, //bcs of IE
                                complete: saveComplete,
                                dataType: "json"
                            });
                        } else {
                            var newForm = $(plugin.settings.SaveMdx.Form, {}).append($('<input>', {
                                'name': 'mdx',
                                'value': getMdx(),
                                'type': 'hidden'
                            }));
                            var modal = $('<div id="jqOlapCubeSaveMdxDialog" title="' + $.jqOlapCube.i18n.SaveMdx.Title + '">', {});
                            modal.append('<hr>').append(newForm).append('<hr>').append('<div style="text-align:center;"><button id="saveOK">' + $.jqOlapCube.i18n.SaveMdx.Save + '</button><button id="saveCancel">' + $.jqOlapCube.i18n.SaveMdx.Cancel + '</button></div>');
                            modal.find('#saveOK').click(function () {
                                $.ajax({
                                    url: plugin.settings.SaveMdx.URL,
                                    type: "POST",
                                    data: newForm.serialize(),
                                    cache: false, //bcs of IE
                                    complete: saveComplete,
                                    dataType: "json"
                                });
                                modal.dialog("close");
                            });

                            modal.find('#saveCancel').click(function () {
                                modal.dialog("close");
                            });

                            modal.dialog({
                                width: "70%",
                                modal: true
                            });

                        }

                    }
                });
                toolbarDiv.append(btnSaveMdx);
                btnSaveMdx.attr('disabled', 'disabled');
            }

            toolbarDiv.append('<div class="jqOlapCube-spinner"/>');
            toolbarDiv.append(statusDiv);

            leftDiv.addClass("jqOlapCubeLeft");
            rightDiv.addClass("jqOlapCubeRight");

            tableDiv.html(rTable.getHtml(onColumns, onRows, onSort));

            filterDiv.droppable({
                accept: "[uname][etype=Member]",
                activeClass: "drag-on",
                // hoverClass: "ui-state-active",
                drop: function (event, ui) {
                    var qe = new QueryElement($(ui.draggable[0]));
                    if (qe.isMember()) {
                        addToAxis(qe, "Filter", $(this).attr("pos"));
                    } else {
                        window.alert('unknown etype (for filter)');
                    }
                }
            });

            garbageDiv.droppable({
                accept: "[uname]",
                hoverClass: "jqOlapCube-gcan-hover",
                drop: function (event, ui) {
                    if ($(ui.draggable[0]).attr("from") === 'Filter')
                        removeFromFilter(new QueryElement($(ui.draggable[0])));
                    else
                        removeFromQuery(new QueryElement($(ui.draggable[0])));
                }
            });
            updateFilterPane();

        };

        // fire up the plugin!
        // call the "constructor" method
        plugin.init();

    };

    // add the plugin to the jQuery.fn object
    $.fn.jqOlapCube = function (options) {

        // iterate through the DOM elements we are attaching the plugin to
        return this.each(function () {

            // if plugin has not already been attached to the element
            if (undefined === $(this).data('jqOlapCube')) {

                // create a new instance of the plugin
                // pass the DOM element and the user-provided options as arguments
                var plugin = new $.jqOlapCube(this, options);

                // in the jQuery version of the element
                // store a reference to the plugin object
                // you can later access the plugin and its methods and properties like
                // element.data('jqOlapCube').publicMethod(arg1, arg2, ... argn) or
                // element.data('jqOlapCube').settings.propertyName
                $(this).data('jqOlapCube', plugin);

            }

        });

    };

    // Additional  helper "classes" and assets:

    $.jqOlapCube.i18n = {
        General: {
            Message: "Message",
            Status: "Status",
            Measures: "Measures"
        },
        EmptyTable: {
            DropColumnsCaption: "--drop measures and columns here--",
            DropRowsCaption: "--drop rows here--"
        },
        Filter: {
            DropCaption: "--drop filter members here--",
            SelectMembersTitle: "Please select allowed members",
            SelectMembersAll: "All",
            SelectMembersNone: "None",
            SelectMembersOK: "OK",
            SelectMembersCancel: "Cancel"
        },
        Toolbar: {
            ReadyCaption: "Ready.",
            PopulatingCaption: "Populating dimension tree...",
            ExecutingCaption: "Executing query...",
            ErrorOccurred: "An error occurred."
        },
        SliceAndDice: {
            Title: "Slice and Dice",
            Apply: "Apply",
            Close: "Close"
        },
        Order: {
            Title: "Please select order criteria",
            OrderType: "Order type",
            None: "None",
            Apply: "Apply",
            Close: "Close"
        },
        SaveMdx: {
            Title: "Save Mdx",
            Save: "Save",
            Cancel: "Cancel"
        }
    };

    // This is fine, these are private, ie in anonymous function scope (module pattern):
    // ResultTable = function(r) ... would be bad (global).

    function ResultTable(r) {
        this.result = r;
    }

    ResultTable.prototype.setResult = function (r) {
        this.result = r;
    };
    ResultTable.prototype.csrs = function (cs, ecs, rs, ers, mcs) {
        var span = "";
        if (cs !== undefined) span += ' colspan="' + cs + '" clpscs="' + cs + '"';
        if (ecs !== undefined) span += ' expndcs="' + ecs + '"';
        if (rs !== undefined) span += ' rowspan="' + rs + '" clpsrs="' + rs + '"';
        if (ers !== undefined) span += ' expndrs="' + ers + '"';
        if (mcs !== undefined) span += ' expndmcs="' + mcs + '"';
        return span;
    };

    ResultTable.prototype.hasCells = function () {
        return this.result && this.result.cSet && this.result.cSet.length;
    };

    ResultTable.prototype.appendOrderIcon = function (uhname, onSort) {
        if (onSort && onSort.member.isMeasure() && onSort.member.uname === uhname) {
            return '<span class="jqOlapCube-order-sort' + onSort.type + '"></span>';
        } else if (onSort && onSort.member.huname === uhname) {
            return '<span class="jqOlapCube-order-sort' + onSort.type + '"></span>';
        }
        return '';
    };

    ResultTable.prototype.getMdxTable = function (merge, onSort) {
        var i;
        var axis0 = this.result.axisInfo[0];
        var axis1 = this.result.axisInfo[1];
        var cSet = this.result.cSet;
        var hc0 = axis0.hierarchies.length;
        var hc1 = axis1.hierarchies.length;
        var pc0 = axis0.positions.length;
        var pc1 = axis1.positions.length;
        var rowsPlaceHolder = '&nbsp;&nbsp;&nbsp;&nbsp;', measuresPlaceHolder = '&nbsp;&nbsp;&nbsp;&nbsp;';
        if (pc0 <= 0) {
            return "Nije dohvaćen niti jedan zapis na kolonama.";
        }
        if (pc1 <= 0) {
            return "Nije dohvaćen niti jedan zapis u retcima.";
        }

        var result = '<TABLE class="jqOlapCube-rtable" >';
        result += ('\n<TR class="jqOlapCube-drag-row-off"><TD axis="Col" pos="0"' + this.csrs(hc1, 2 * hc1 + 1) + '></TD><TD class="drag-on" axis="Col" pos="0"' + this.csrs(1 + pc0 * 2) + '>&nbsp;</TD></TR>');
        for (var h = 0; h < hc0; ++h) {
            result += ("\n<TR>");
            var c;
            if (h === hc0 - 1) {
                // Row dim labels:
                for (c = 0; c < hc1; ++c) {
                    //var foo = axis1.positions[0].members[c].uname;
                    //foo = foo.substring(1, foo.indexOf("]"));
                    result += "\n<TH class=\"drag-on, jqOlapCube-drag-col-off\" rowspan=\"" + (pc1 + 1) + "\" axis=\"Row\" pos=\"" + c + "\">" + rowsPlaceHolder + "</TH>" + " <TH class = \"jqOlapCube-cheader\" etype=\"Hierarchy\" uname=\"" + axis1.hierarchies[c].uname + "\" huname=\"" + axis1.hierarchies[c].uname + "\">" + axis1.hierarchies[c].caption + this.appendOrderIcon(axis1.hierarchies[c].uname, onSort) + "</TH>";  // "\n<TH class=\"jqOlapCube-drag-col-off\">&nbsp;C#</TH> "
                }
                result += "\n<TH class=\"drag-on, jqOlapCube-drag-col-off\" rowspan=\"" + (pc1 + 1) + "\" axis=\"Row\" pos=\"" + hc1 + "\">" + rowsPlaceHolder + "</TH>"; //"\n<TH class=\"jqOlapCube-drag-col-off\">&nbsp;C#</TH>";
            } else if (h === 0) {
                result += ('\n<TD class="dock" ' + this.csrs(hc1, 2 * hc1 + 1, (hc0 > 1) ? hc0 - 1 : 1, 2 * (hc0 - 1)) + '>&nbsp;</TD>');
            }
            var OldHeader = axis0.positions[0].members[h].caption;
            var headerRow;
            if (h === hc0 - 1) {
                headerRow = '<TH class="drag-on, jqOlapCube-drag-measure-off" axis="Measure" pos="0">' + measuresPlaceHolder + '</TH>' + '<TH class = "jqOlapCube-cheader" colspan = "?" etype="Measure" huname="' + axis0.hierarchies[h].uname + '" caption="' + axis0.positions[0].members[h].caption + '" uname="' + axis0.positions[0].members[h].uname + '">' + axis0.positions[0].members[h].caption + this.appendOrderIcon(axis0.positions[0].members[h].uname, onSort);
            } else {
                headerRow = '<TH class = "jqOlapCube-cheader" colspan = "?" etype="Member" huname="' + axis0.hierarchies[h].uname + '" caption="' + axis0.positions[0].members[h].caption + '" uname="' + axis0.positions[0].members[h].uname + '">' + axis0.positions[0].members[h].caption;
            }
            var colSpan = 1;
            for (i = 1; i < pc0; ++i) {
                if (h === hc0 - 1) headerRow += "<TH class=\"drag-on, jqOlapCube-drag-measure-off\" axis=\"Measure\" pos=\"" + i + "\">" + measuresPlaceHolder + "</TH>";
                if (axis0.positions[i].members[h].caption != OldHeader) {
                    OldHeader = axis0.positions[i].members[h].caption;
                    headerRow += "</TH>";
                    headerRow = headerRow.replace("colspan = \"?\"", ((h === hc0 - 1) ? "colspan = \"" + colSpan + "\"" : this.csrs(colSpan, undefined, undefined, undefined, colSpan * 2)));
                    headerRow += '\n<TH class = "jqOlapCube-cheader" colspan = "?"' + ((h < hc0 - 1) ? ' etype="Member" ' : ' etype="Measure" ') + ' huname="' + axis0.hierarchies[h].uname + '" caption="' + axis0.positions[i].members[h].caption + '" uname="' + axis0.positions[i].members[h].uname + '"' + '>' + axis0.positions[i].members[h].caption + this.appendOrderIcon(axis0.positions[i].members[h].uname, onSort);
                    colSpan = 0;
                }
                ++colSpan;
            }
            headerRow = headerRow.replace("colspan = \"?\"", ((h === hc0 - 1) ? "colspan = \"" + colSpan + "\"" : this.csrs(colSpan, undefined, undefined, undefined, colSpan * 2 + 1)));
            result += headerRow;
            result += "</TH>";
            if (h === hc0 - 1) result += "<TH class=\"drag-on, jqOlapCube-drag-measure-off\" axis=\"Measure\" pos=\"" + pc0 + "\" >" + measuresPlaceHolder + "</TH>";
            result += "</TR>";
            if (h < hc0 - 1) {
                result += ('\n<TR class="jqOlapCube-drag-row-off"><TD class="drag-on" colspan="' + (1 + pc0 * 2) + '" axis="Col" pos="' + (h + 1) + '">&nbsp;</TD></TR>');
            }
        }


        //var sum = [];
        //var percentageMask = 0;
        var oldH = [];
        var rowSpan = [];
        var baseLevelDepth = [];
        var className;
        var row = "";
        for (h = 0; h < hc1; ++h) {
            oldH[h] = "";
            rowSpan[h] = 0;
            baseLevelDepth[h] = axis1.positions[0].members[h].leveldepth;
        }
        var rowClassNameNo, oldRowClassNameNo, resultFieldClassNo;
        oldRowClassNameNo = 1;
        rowClassNameNo = 0;
        for (var j = 0; j < pc1; ++j) {
            row += "\n<TR >";
            for (h = 0; h < hc1 - 1; ++h) {
                // row += (j==0) ? "\n\t<TD class=\"drag-on, jqOlapCube-drag-col-off\" rowspan=\"" + pc1 + "\" axis=\"Row\" pos=\"" + h + "\">C#1</TD>" : '';
                if ((merge === false) || (axis1.positions[j].members[h].caption != oldH[h])) {
                    oldH[h] = axis1.positions[j].members[h].caption;
                    row = row.replace("rs" + h + " = \"?\"", "rowspan = \"" + rowSpan[h] + "\"");
                    rowSpan[h] = 0;
                    if (h === 0) {
                        rowClassNameNo = 1 - rowClassNameNo;
                        for (var hh = 1; hh < hc1; ++hh) {
                            row = row.replace("rs" + hh + " = \"?\"", "rowspan = \"" + rowSpan[hh] + "\"");
                        }
                        result += (row);
                        row = "";
                        for (var r = 1; r < hc1 - 1; ++r) {
                            oldH[r] = "";
                        }
                    }
                    row += "\n\t<TD class = \"jqOlapCube-rheader" + rowClassNameNo + "\" rs" + h + " = \"?\" etype=\"Member\" huname=\"" + axis1.hierarchies[h].uname + "\" caption=\"" + axis1.positions[j].members[h].caption + "\" uname=\"" + axis1.positions[j].members[h].uname + "\">" + this.indent(this.pos(3 * (axis1.positions[j].members[h].leveldepth - baseLevelDepth[h]))) + axis1.positions[j].members[h].caption + "</TD>";
                }
                ++rowSpan[h];
            }
            row += "\n\t<TD class = \"jqOlapCube-rheader" + rowClassNameNo + "\" rowspan = \"1\" etype=\"Member\" huname=\"" + axis1.hierarchies[hc1 - 1].uname +
                    "\" caption=\"" + axis1.positions[j].members[hc1 - 1].caption +
                    "\" uname=\"" + axis1.positions[j].members[hc1 - 1].uname + "\">" +
                    this.indent(this.pos(3 * (axis1.positions[j].members[hc1 - 1].leveldepth - baseLevelDepth[hc1 - 1]))) +
                    axis1.positions[j].members[hc1 - 1].caption + "</TD>";

            if ((oldRowClassNameNo != rowClassNameNo)) {
                resultFieldClassNo = 0;
                oldRowClassNameNo = rowClassNameNo;
            } else {
                resultFieldClassNo = 1;
            }
            for (var k = 0; k < pc0; ++k) {
                if (j % 2 === 0) {
                    className = "\n\t<TD class =\"jqOlapCube-cellwhite" + resultFieldClassNo + "\">";
                } else {
                    className = "\n\t<TD class =\"jqOlapCube-cellyellow" + resultFieldClassNo + "\">";
                }
                row += className + this.fs(cSet[j * pc0 + k].formattedValue) + "</TD>";

            }
            row += "\n</TR >";
        }

        for (h = 0; h < hc1; ++h) {
            row = row.replace("rs" + h + " = \"?\"", "rowspan = \"" + rowSpan[h] + "\"");
        }
        result += row;
        result += "</TABLE>";

        return result;

    };

    ResultTable.prototype.getHtml = function (onColumns, onRows, onSort) { // , onFilter
        if (!this.hasCells()) { // && (!self.onRows || !self.onColumns)

            var mcCaption = '<span class="jqOlapCube-emptytable-caption">' + $.jqOlapCube.i18n.EmptyTable.DropColumnsCaption + '</span>',
                rCaption = '<span class="jqOlapCube-emptytable-caption">' + $.jqOlapCube.i18n.EmptyTable.DropColumnsCaption + '</span>';

            for (var i = 0 ; i < 2; ++i) {
                var currAxis = (i === 0) ? onColumns : onRows;
                var desc = '';
                var axisall = [];
                for (var index = 0; index < currAxis.length; ++index) {
                    desc = '';
                    var all = [];
                    for (var curri = 0; curri < currAxis[index].length; ++curri) {
                        all.push((currAxis[index])[curri].uname);
                    }
                    // $.each(currAxis[index], function (index, value) {
                    //     all.push(value.uname);
                    // });
                    axisall.push("(" + all.join(", ") + ")");
                }
                if (axisall.length)
                    if (i === 0) mcCaption = '&nbsp;<br>' + axisall.join(" * ") + '<br>&nbsp;';
                    else rCaption = '&nbsp;<br>' + axisall.join(" * ") + '<br>&nbsp;';
            }

            return '<table  class="jqOlapCube-emptytable" >' +
                    '   <tr class="jqOlapCube-emptytr"> ' +
                    '       <td> &nbsp;</td> ' +
                    '       <td id="mcDropZone" class="jqOlapCube-drag-measure-off jqOlapCube-drag-col-off jqOlapCube-display-on " axis="Col">' + mcCaption + '</td> ' +
                    '   </tr>  ' +
                    '   <tr> ' +
                    '       <td id="rDropZone" axis="Row" class="jqOlapCube-drag-row-off  jqOlapCube-display-on ">' + rCaption + '</td> ' +
                    '       <td style="text-align: center;">(...)</td> ' +
                    '   </tr>   ' +
                    '</table>';
        } else
            return this.getMdxTable(true, onSort);
    };
    ResultTable.prototype.pos = function (n) { return (n > 0) ? n : 0; };
    ResultTable.prototype.indent = function (n) {
        var i, result = '';
        for (i = 0; i < n; ++i) result += '&nbsp;';
        return result;
    };
    ResultTable.prototype.fs = function (str) {
        str = str.trim();
        if (str === "") {
            return "";
        } else if (str === "1,#INF" || str === "1,#J" || str === "1#I,NF%" || str === "1,JE+00" || str === "1.#INF" || str === "1.#J" || str === "1#I.NF%" || str === "1.JE+00") {
            return "<SPAN style=\"FONT-SIZE: 14pt;\">&#8734;</SPAN>";
        } else if (str === "-1,#INF" || str === "-1,#J" || str === "-1#I,NF%" || str === "-1,JE+00" || str === "-1.#INF" || str === "-1.#J" || str === "-1#I.NF%" || str === "-1.JE+00") {
            return "<SPAN style=\"FONT-SIZE: 10pt;\">-&#8734;</SPAN>";
        } else {
            return str;
        }
    };

    function QueryElement(node) {
        this.caption = node.attr("caption");
        this.uname = node.attr("uname");
        this.huname = node.attr("huname");
        this.etype = node.attr("etype");
        this.duname = node.attr("duname");
        this.exceptMembers = [];
        this.drillMembers = [];
    }
    QueryElement.prototype.getMembersExpression = function () {
        var expr;
        if (this.etype === 'Dimension' || this.etype === 'Hierarchy' || this.etype === 'Level') expr = this.uname + '.Members';
        else if (this.etype === 'Measure') expr = this.uname;
        else return null;

        if (this.drillMembers.length) {
            expr = 'DrilldownMember(' + expr + ', {' + this.drillMembers.join(", ") + '}' + ((this.drillMembers.length > 1) ? ', RECURSIVE' : '') + ')';
        }
        if (this.exceptMembers.length) {
            var exparr = [];
            $.each(this.exceptMembers, function (i, val) {
                exparr.push(val.uname);
            });
            expr = 'Except({' + expr + '}, {' + exparr.join(", ") + '})';
        }
        return expr;
    };

    QueryElement.prototype.isSameHierarchy = function (other) {
        return (this.huname === other.huname);
    };

    QueryElement.prototype.isMeasure = function () {
        var pos = this.huname.indexOf('Measure');
        return (pos === 0 || pos === 1);
    };

    QueryElement.prototype.isHierarchy = function () {
        return (this.etype === 'Hierarchy');
    };
    QueryElement.prototype.isMember = function () {
        return (this.etype === 'Member');
    };

    QueryElement.prototype.isLevel = function () {
        return (this.etype === 'Level');
    };

    QueryElement.prototype.addExceptMember = function (qe) {
        this.exceptMembers.push(qe);
    };

    QueryElement.prototype.toggleDrillMember = function (qe) {
        for (var i = 0; i < this.drillMembers.length; ++i) {
            if (this.drillMembers[i] === qe.uname) {
                this.drillMembers.splice(i, 1);
                return;
            }
        }
        this.drillMembers.push(qe.uname);
    };

    QueryElement.prototype.toHtml = function () {
        return 'caption="' + this.caption + '" uname="' + this.uname + '" huname="' + this.huname + '" etype="' + this.etype + '"';
    };







    //Visualisation

    var visSettings;
    var tooltip;

    var initialiseVisSettings = function () {
        visSettings = getNewVisSettings(250,250);

        tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
    }


    var getNewVisSettings = function (width,height) {
        var visSettings = { "enabled": 1, "data": null, "dimensions": "00" };


        visSettings["d1"] = [x0y1BarChart, x0y1LineChart, x0y1PieChart];
        visSettings["d1bool"] = [true, false, false];
        visSettings["d2"] = [stackedBarChart, multiLineChart, visualiseHeatMap, visualiseTreeMap, visualiseParallel];
        visSettings["d2bool"] = [true, false, false, false, false];
        visSettings["d"] = [visualiseTreeMap, visualiseParallel, visualiseHeatMap];
        visSettings["dbool"] = [true, false, false];


        var size = { top: 20, right: 60, bottom: 30, left: 40 };
        size["width"] = width;
        size["height"] = height;

        visSettings["size"] = size;

        var color = d3.scale.category10()
        var treecolor = d3.scale.category20();
        visSettings["barSettings"] = { 'size': Object.create(size) };
        visSettings["lineSettings"] = { 'size': Object.create(size) };
        visSettings["pieSettings"] = { 'color': color, 'size': Object.create(size) };
        visSettings["stackedBarSettings"] = { 'color': color, 'size': Object.create(size) };
        visSettings["multiLineChartSettings"] = { 'color': color, 'size': Object.create(size) };
        visSettings["heatMapSettings"] = { 'size': Object.create(size) };
        visSettings["treeMapSettings"] = { 'color': treecolor, 'size': Object.create(size), 'padding': 10 };
        visSettings["parallelCoordinatesSettings"] = { 'size': Object.create(size) };

        return visSettings;
    }
    var visualiseData = function (data) {
        var yAxis = data.axisInfo[1];
        var xAxis = data.axisInfo[0];



        var totalData = data.cSet.length

        var yDimensionsCount = yAxis.hierarchies.length ;
        var xDimensionsCount = xAxis.hierarchies.length -1;

        var y1Set = new Set();
        var y2Set = new Set();
        for (var i = 0; i < yAxis.positions.length; i++) {
            y1Set.add(yAxis.positions[i].members[0].caption);
            if (yDimensionsCount == 2) {
                y2Set.add(yAxis.positions[i].members[1].caption);

            }
        }
        var y1Count = y1Set.size;
        var y2Count = y2Set.size;



        var x1Set = new Set();
        var x2Set = new Set();
        var mSet = new Set();
        for (var i = 0; i < xAxis.positions.length; i++) {
            switch(xDimensionsCount) {
                case 0:
                    mSet.add(xAxis.positions[i].members[0].caption);
                    break;
                case 1:
                    x1Set.add(xAxis.positions[i].members[0].caption);
                    mSet.add(xAxis.positions[i].members[1].caption);
                    break;
                case 2:
                    x1Set.add(xAxis.positions[i].members[0].caption);
                    x2Set.add(xAxis.positions[i].members[1].caption);
                    mSet.add(xAxis.positions[i].members[2].caption);
                    break;
            } 

            
        }
        var x1Count = x1Set.size;
        var x2Count = x2Set.size;
        var mCount = mSet.size;

        
       
        var pData = prepareData(data);
        var visDataAll = pData.visDataAll;
        var dimensionsX = pData.dimensionsX;
        var dimensionsY = pData.dimensionsY;



        $(".gridster").remove();
        var gridsterDiv = $('<div class="gridster"><ul style="list-style: none;"></ul></div>');
        $(".jqOlapCubeRight").append(gridsterDiv);


        visSettings.dimensions = xDimensionsCount.toString() + yDimensionsCount.toString();
        switch (visSettings.dimensions) {
            case "01":
                for (var i = 0; i < visDataAll.length; i++) {
                    x0y1Visualise(visDataAll[i]);
                }
                break;
            case "02":
                x0y2Visualise(data);
                break;
            case "11":
                for (var i = 0; i < visDataAll.length; i++) {
                    x1y1Visualise(visDataAll[i], dimensionsX, dimensionsY);
                }
                break;
            default:

            for (var i = 0; i < visDataAll.length; i++) {
                visOther(visDataAll[i],dimensionsX,dimensionsY)

            }
        }









        var widgets = $("svg");
         var gridster = $(".gridster > ul").gridster({
             widget_margins: [5, 5],
             widget_base_dimensions :[100,100],
                avoid_overlapped_widgets: true,
                extra_cols: 10,
                helper: 'clone',
                resize: {
                    enabled: true,
                    resize: function (e, ui, $widget) {
                        var newHeight = $widget.height();
                        var newWidth = $widget.width();
                        var svg = $widget[0].firstChild;
                        var svg2 = $(svg);
                        svg2.attr("width", newWidth);
                        svg2.attr("height", newHeight);
                        var settings = visSettings[svg2.attr("settings")].size;
                        if (!isNaN(newWidth)) settings.width = newWidth - settings.left - settings.right;
                        if (!isNaN(newHeight)) settings.height = newHeight - settings.top - settings.bottom;

                    }
                }
            }).data('gridster');



         for (var i = 0; i < widgets.length; i++) {
             var test = $("<li></li>").append(widgets[i]);
             var width = Math.ceil(widgets[i].getAttribute("width") / 100);
             var height = Math.ceil(widgets[i].getAttribute("height") / 100);
             var widget = gridster.add_widget(test);
             gridster.resize_widget(widget, width, height);

         }



    }

    var prepareData = function (data) {

        var measures = new Set();
        var measuresArray = [];
        var dimensionsX = new Set();
        var dimensionsXArray = []
        var dimensionsXArrayWithRepetition = [];

        var dimensionsX2 = [];
        var dimensionsY2 = [];
        for (var i = 0; i < data.axisInfo[0].positions.length; i++) {
            if (!measures.has(data.axisInfo[0].positions[i].members[data.axisInfo[0].positions[i].members.length - 1].caption)) {
                measuresArray.push(data.axisInfo[0].positions[i].members[data.axisInfo[0].positions[i].members.length - 1].caption);

            }
            measures.add(data.axisInfo[0].positions[i].members[data.axisInfo[0].positions[i].members.length - 1].caption);
            var dimension = "";
            var dimensionArray = [];
            for (var j = 0; j < data.axisInfo[0].positions[i].members.length - 1; j++) {
                dimension = dimension + data.axisInfo[0].positions[i].members[j].caption + " ";
                dimensionArray.push(data.axisInfo[0].positions[i].members[j].caption);
            }
            if (!dimensionsX.has(dimension)) {
                dimensionsXArray.push(dimension);

            }
            dimensionsX.add(dimension);
            dimensionsXArrayWithRepetition.push(dimension);
            dimensionsX2.push(dimensionArray);
            dimensionArray = null;
        }

        var dimensionsY = []


        for (var i = 0; i < data.axisInfo[1].positions.length; i++) {
            var dimension = "";
            var dimesionArray = new Array();
            for (var j = 0; j < data.axisInfo[1].positions[i].members.length; j++) {

                dimension = dimension + data.axisInfo[1].positions[i].members[j].caption + " ";
                dimesionArray.push(data.axisInfo[1].positions[i].members[j].caption);

            }
            dimensionsY.push(dimension);
            dimensionsY2.push(dimesionArray);
            dimesionArray = null;


        }
        var hierarchyX = [];
        var previousLevel = [];
        var levelDepth;
        for (var i = 0; i < data.axisInfo[0].positions.length; i++) {
            hierarchyX[i] = [];
        }
        for (var i = 0; i < data.axisInfo[0].positions[0].members.length; i++) {
            previousLevel = new Array();
            levelDepth = "";
            levelDepth = data.axisInfo[0].positions[0].members[i].leveldepth;
            var caption = data.axisInfo[0].positions[0].members[i].caption


            for (var j = 0; j < data.axisInfo[0].positions.length; j++) {

                var level = data.axisInfo[0].positions[j].members[i].leveldepth;




                if (levelDepth < level) {

                    previousLevel.push(caption);
                }
                else {
                    if (levelDepth > level) {
                        previousLevel.pop();

                    }
                }
                caption = data.axisInfo[0].positions[j].members[i].caption;
                hierarchyX[j][i] = previousLevel.slice();
                levelDepth = level;


            }
            previousLevel = null;
        }









        var hierarchyY = [];

        for (var i = 0; i<data.axisInfo[1].positions.length; i++ ) {
            hierarchyY[i] = [];
        }

        for (var i = 0; i < data.axisInfo[1].positions[0].members.length; i++) {
            previousLevel = new Array();
            levelDepth = "";
            levelDepth = data.axisInfo[1].positions[0].members[i].leveldepth;
            var caption = data.axisInfo[1].positions[0].members[i].caption


            for (var j = 0; j < data.axisInfo[1].positions.length; j++) {

                var level = data.axisInfo[1].positions[j].members[i].leveldepth;
               



                if (levelDepth < level) {

                    previousLevel.push(caption);
                }
                else {
                    if (levelDepth > level) {
                        previousLevel.pop();

                    }
                }
                caption = data.axisInfo[1].positions[j].members[i].caption;
                hierarchyY[j][i] = previousLevel.slice();
                levelDepth = level;


            }
            previousLevel = null;
        }















        var visDataAll = []
        for (var i = 0; i < measuresArray.length; i++) {
            var visDataArray = [];
            for (var j = 0; j < data.axisInfo[1].positions.length; j++) {

                for (var k = 0; k < data.axisInfo[0].positions.length; k++) {
                    var currMeasure = data.axisInfo[0].positions[k].members[data.axisInfo[0].positions[k].members.length - 1].caption;
                    if (currMeasure === measuresArray[i]) {
                        var visData = {
                            "x": dimensionsXArrayWithRepetition[k], "y": dimensionsY[j], "v": data.cSet[j * data.axisInfo[0].positions.length + k].value, "fv": data.cSet[j * data.axisInfo[0].positions.length + k].formattedValue,
                            "tx": data.axisInfo[0].positions.length- k, "ty": data.axisInfo[1].positions.length - j
                        };
                        for (var l = 0; l< dimensionsX2[k].length; l++){
                            visData["x" + l.toString()] = dimensionsX2[k][l];
                        }
                        for (var l = 0; l < dimensionsY2[j].length; l++) {
                            visData["y" + l.toString()] = dimensionsY2[j][l];
                        }

                        for (var m = 0; m < hierarchyX[k].length; m++) {
                            if (hierarchyX[k][m].length !== 0) visData["xh" + m] = hierarchyX[k][m];
                        }
                        for (var m = 0; m < hierarchyY[j].length; m++) {
                            if (hierarchyY[j][m].length !== 0) visData["yh" + m] = hierarchyY[j][m];
                        }

                        visDataArray.push(visData);
                    }
                }
            }
            visDataAll.push(visDataArray);
        }
        var returnValue = { "visDataAll": visDataAll, "dimensionsX": dimensionsXArray, "dimensionsY": dimensionsY };
        return returnValue;

    }

    var x0y1Visualise = function (data) {
        for (var i = 0; i < visSettings.d1bool.length; i++) {
            if (visSettings.d1bool[i]) visSettings.d1[i](data);
        }




      
    }

    var x0y1BarChart = function (data) {

        var margin = visSettings.barSettings.size;
        var width = margin.width,
        height = margin.height;



        var x = d3.scale.ordinal()
            .rangeRoundBands([0, width], .1)
            .domain(data.map(function (d) { return d.y; }));

        var y = d3.scale.linear()
            .range([height, 0])
            .domain([0, d3.max(data, function(d) { return d.v; })]);


        var xAxis = d3.svg.axis()
            .scale(x)
            .tickSize(5)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .scale(y)
            .tickFormat(d3.format("s"))
            .orient("left");


        var svg = d3.select("body").append("svg")
            .attr("settings", "barSettings")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)");


        svg.selectAll(".bar")
            .data(data)
          .enter().append("rect")
            .attr("class", "bar")
            .attr("x", function (d) { return x(d.y); })
            .attr("width", x.rangeBand())
            .attr("y", function (d) { return y(d.v); })
            .attr("height", function (d) { return height - y(d.v); })
          .on("mouseover", function (d) {
              tooltip.transition()
                   .duration(200)
                   .style("opacity", .9);
              tooltip.html(d.y
                + ": " + d.fv)
                   .style("left", (d3.event.pageX + 5) + "px")
                   .style("top", (d3.event.pageY - 28) + "px");
              highlightCell(d.tx, d.ty);

          })
          .on("mouseout", function (d) {
              tooltip.transition()
                   .duration(500)
                   .style("opacity", 0);
              highlightCell(d.tx, d.ty);
          });



    }

    var x0y1PieChart = function (data) {

        var margin = visSettings.pieSettings.size;
        var width = margin.width,
        height = margin.height;


        var radius = Math.min(width, height) / 2;


        var color = visSettings.pieSettings.color;
             color.domain(data.map(function (d) { return d.y; }));

        var arc = d3.svg.arc()
            .outerRadius(radius - 10)
            .innerRadius(0);

        var pie = d3.layout.pie()
            .sort(null)
            .value(function (d) { return d.v; });

        var svg = d3.select("body").append("svg")
            .attr("settings", "pieSettings")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
          .append("g")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        var g = svg.selectAll(".arc")
            .data(pie(data))
          .enter().append("g")
            .attr("class", "arc")


        g.append("path")
            .attr("d", arc)
            .style("fill", function (d) { return color(d.data.y); });

        g.append("text")
            .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
            .attr("dy", ".35em")
            .style("text-anchor", "middle")
            .text(function (d) { return d.data.y; });
        g.on("mouseover", function (d) {
            tooltip.transition()
                 .duration(200)
                 .style("opacity", .9);
            tooltip.html(d.data.y
              + ": " + d.data.fv)
                 .style("left", (d3.event.pageX + 5) + "px")
                 .style("top", (d3.event.pageY - 28) + "px");
            highlightCell(d.data.tx, d.data.ty);
        })
   .on("mouseout", function (d) {
       tooltip.transition()
            .duration(500)
            .style("opacity", 0);
       highlightCell(d.data.tx, d.data.ty);
   });

        var legend = svg.selectAll(".legend")
             .data(color.domain().slice().reverse())
           .enter().append("g")
             .attr("class", "legend")
             .attr("transform", function (d, i) { return "translate(0," + i * 20 + ")"; });

        legend.append("rect")
            .attr("x", width -100 )
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", color);

        legend.append("text")
            .attr("x", width  -20)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(function (d) { return d; });

        svg.append("svg:image")
            .attr("x", width - 100)
            .attr("y", height -100)
            .attr("width", 20)
            .attr("height", 20)
            .attr("xlink:href", "Scripts/jqOlapCube/css/Settings.png")
            .on("click", function(){settingsDialog("pieSettings",true, false);});

    }

    var x0y1LineChart = function (data) {


        var margin = visSettings.lineSettings.size;
        var width = margin.width,
        height = margin.height;


        var x = d3.scale.ordinal()
            .rangeRoundBands([0, width],1)
            .domain(data.map(function (d) { return d.y; }));

        var y = d3.scale.linear()
            .range([height, 0])
             .domain([0, d3.max(data, function (d) { return d.v; })]);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .scale(y)
            .tickFormat(d3.format("s"))
            .orient("left");

        var line = d3.svg.line()
            .x(function (d) { return x(d.y); })
            .y(function (d) { return y(d.v); });

        var svg = d3.select("body").append("svg")
            .attr("settings", "lineSettings")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis);

            svg.append("g")
                .attr("class", "y axis")
                .call(yAxis)
              .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em");

            svg.append("path")
                .datum(data)
                .attr("class", "line")
                .attr("d", line);
    }

    var x0y2Visualise = function (data) {

        var measures = new Set();
        var measuresArray = [];

        var xdimensionSet = new Set();
        var ydimensionSet = new Set();
        var xdimensions = []
        var ydimensions = []

        for (var i = 0; i < data.axisInfo[0].positions.length; i++) {
            if (!measures.has(data.axisInfo[0].positions[i].members[data.axisInfo[0].positions[i].members.length - 1].caption)) {
                measuresArray.push(data.axisInfo[0].positions[i].members[data.axisInfo[0].positions[i].members.length - 1].caption);

            }
            measures.add(data.axisInfo[0].positions[i].members[data.axisInfo[0].positions[i].members.length - 1].caption);
          
        }

        var dimensionsY = []
        for (var i = 0; i < data.axisInfo[1].positions.length; i++) {
            var dimension = [];
            for (var j = 0; j < data.axisInfo[1].positions[i].members.length; j++) {
                dimension.push(data.axisInfo[1].positions[i].members[j].caption);
            }

            if (!xdimensionSet.has(dimension[0])) xdimensions.push(dimension[0]);
            xdimensionSet.add(dimension[0]);
            if (!ydimensionSet.has(dimension[1])) ydimensions.push(dimension[1]);
            ydimensionSet.add(dimension[1]);


            dimensionsY.push(dimension);

        }
        var visDataAll = []

        for (var i = 0; i < measuresArray.length; i++) {
            var visDataArray = [];
            for (var j = 0; j < data.axisInfo[1].positions.length; j++) {

                for (var k = 0; k < data.axisInfo[0].positions.length; k++) {
                    var currMeasure = data.axisInfo[0].positions[k].members[data.axisInfo[0].positions[k].members.length - 1].caption;
                    if (currMeasure === measuresArray[i]) {
                        var visData = {
                            "x": dimensionsY[j][0], "y": dimensionsY[j][1], "v": data.cSet[j * data.axisInfo[0].positions.length + k].value, "fv": data.cSet[j * data.axisInfo[0].positions.length + k].formattedValue
                        };
                        visData["y0"] = dimensionsY[j][0];
                        visData["y1"] = dimensionsY[j][1];
                        visDataArray.push(visData);
                    }
                }
            }
            visDataAll.push(visDataArray);
        }

        
        for (var i = 0; i < visDataAll.length; i++) {
            x1y1Visualise(visDataAll[i], xdimensions, ydimensions);
        }

    }

    var x1y1Visualise = function (data, dimensionsX, dimensionsY) {

        for (var k = 0; k < visSettings.d2bool.length; k++) {
            if (visSettings.d2bool[k]) {
                var graph = visSettings.d2[k];

                if (graph === stackedBarChart || graph === multiLineChart) {
                    var visData = [];
                    var x = data[0].y;
                    var values = [];
                    var fvalues = [];
                    var yvalues = [];

                    if (dimensionsX.length > dimensionsY.length) {
                        data.sort(function (a, b) {
                            var x = a["x"]; var y = b["x"];
                            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
                        });
                        x = data[0].x;

                        for (var i = 0; i < data.length; i++) {
                            if (x === data[i].x) {
                                values.push(data[i].v)
                                fvalues.push(data[i].fv)
                                yvalues.push(data[i].y);

                            }
                            else {

                                var json = {};
                                json["x"] = x;
                                for (var j = 0; j < values.length; j++) {
                                    json[yvalues[j].toString()] = values[j];
                                }
                                visData.push(json);

                                x = data[i].x;
                                values = [];
                                fvalues = [];
                                yvalues = [];

                                values.push(data[i].v)
                                fvalues.push(data[i].fv)
                                yvalues.push(data[i].y);

                            }


                        }







                    }
                    else {
                        data.sort(function (a, b) {
                            var x = a["y"]; var y = b["y"];
                            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
                        });
                        x = data[0].y;

                        for (var i = 0; i < data.length; i++) {
                            if (x === data[i].y) {
                                values.push(data[i].v)
                                fvalues.push(data[i].fv)
                                yvalues.push(data[i].x);

                            }
                            else {

                                var json = {};
                                json["x"] = x;
                                for (var j = 0; j < values.length; j++) {
                                    json[yvalues[j].toString()] = values[j];
                                }
                                visData.push(json);

                                x = data[i].y;
                                values = [];
                                fvalues = [];
                                yvalues = [];

                                values.push(data[i].v)
                                fvalues.push(data[i].fv)
                                yvalues.push(data[i].x);

                            }


                        }


                    }
                    var json = {};
                    json["x"] = x;
                    for (var j = 0; j < values.length; j++) {
                        json[yvalues[j].toString()] = values[j];
                    }
                    visData.push(json);
                    graph(visData);
                }
                else {
                    graph(data, dimensionsX, dimensionsY);


                }
            }
        }




        
    }


    var stackedBarChart = function (data) {

        var margin = visSettings.stackedBarSettings.size;
        var width = margin.width,
        height = margin.height;



        var x = d3.scale.ordinal()
            .rangeRoundBands([0, width], .1);

        var y = d3.scale.linear()
            .rangeRound([height, 0]);

        var color = visSettings.stackedBarSettings.color;

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .tickFormat(d3.format(".2s"));

        var svg = d3.select("body").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


            color.domain(d3.keys(data[0]).filter(function (key) { return key !== "x"; }));
            data.forEach(function (d) {
                var y0 = 0;
                d.stacks = color.domain().map(function (name) { return { name: name, y0: y0, y1: y0 += +d[name] }; });
                d.total = d.stacks[d.stacks.length - 1].y1;
             });

            data.sort(function (a, b) { return b.v - a.v; });

            x.domain(data.map(function (d) { return d.x; }));
            y.domain([0, d3.max(data, function (d) { return d.total; })]);

            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis);

            svg.append("g")
                .attr("class", "y axis")
                .call(yAxis)
              .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em");

            var rect = svg.selectAll(".state")
                .data(data)
              .enter().append("g")
                .attr("class", "g")
                .attr("transform", function (d) { return "translate(" + x(d.x) + ",0)"; });

            rect.selectAll("rect")
                .data(function (d) { return d.stacks; })
              .enter().append("rect")
                .attr("width", x.rangeBand())
                .attr("y", function (d) { return y(d.y1); })
                .attr("height", function (d) { return y(d.y0) - y(d.y1); })
                .style("fill", function (d) { return color(d.name); });
                
                




            var legend = svg.selectAll(".legend")
                .data(color.domain().slice().reverse())
              .enter().append("g")
                .attr("class", "legend")
                .attr("transform", function (d, i) { return "translate(0," + i * 20 + ")"; });

            legend.append("rect")
                .attr("x", width + 55)
                .attr("width", 18)
                .attr("height", 18)
                .style("fill", color);

            legend.append("text")
                .attr("x", width + 50)
                .attr("y", 9)
                .attr("dy", ".35em")
                .style("text-anchor", "end")
                .text(function (d) { return d; });



        svg.append("svg:image")
        .attr("x", width+10)
        .attr("y", height- 20)
        .attr("width", 20)
        .attr("height", 20)
        .attr("xlink:href", "Settings.png")
        .on("click", function () { settingsDialog("stackedBarSettings", true, false); });
    }

    var multiLineChart = function (data) {

        var margin = visSettings.multiLineChartSettings.size;
        var width = margin.width,
        height = margin.height;



        var parseDate = d3.time.format("%Y%m%d").parse;

        var x = d3.scale.ordinal()
            .rangeRoundBands([0, width], 1);

        var y = d3.scale.linear()
            .range([height, 0]);

        var color = visSettings.multiLineChartSettings.color;

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .tickFormat(d3.format("s"));

        var line = d3.svg.line()
            .interpolate("basis")
            .x(function (d) { return x(d.x); })
            .y(function (d) { return y(d.v); });

        var svg = d3.select("body").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


            color.domain(d3.keys(data[0]).filter(function (key) { return key !== "x"; }));


            var colors = color.domain().map(function (name) {
                return {
                    name: name,
                    values: data.map(function (d) {
                        return { x: d.x, v: +d[name] };
                    })
                };
            });



            for (var i = 0; i < data.length; i++) {
                var max = null;
                for (var j = 0; j < colors.length; j++) {
                    if (max < data[i][colors[j].name]) max = data[i][colors[j].name];
                }
                data[i]["max"] = max;
            }





            x.domain(data.map(function (d) { return d.x; }));
            y.domain([0, d3.max(data, function (d) { return d.max; })]);

            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis);

            svg.append("g")
                .attr("class", "y axis")
                .call(yAxis)
              .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em");
            var graph = svg.selectAll(".city")
            .data(colors)
            .enter().append("g")
            .attr("class", "city");

            graph.append("path")
                    .attr("class", "line")
                    .attr("d", function (d) { return line(d.values); })
                    .style("stroke", function (d) { return color(d.name); });

            graph.append("text")
                    .datum(function (d) { return { name: d.name, value: d.values[d.values.length - 1] }; })
                    .attr("transform", function (d) { return "translate(" + x(d.value.x) + "," + y(d.value.v) + ")"; })
                    .attr("x", 3)
                    .attr("dy", ".35em");
                    //.text(function (d) { return d.name; });

            var legend = svg.selectAll(".legend")
                .data(color.domain().slice().reverse())
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", function (d, i) { return "translate(0," + i * 20 + ")"; });

            legend.append("rect")
                .attr("x", width + 55)
                .attr("width", 18)
                .attr("height", 18)
                .style("fill", color);

            legend.append("text")
                .attr("x", width + 50)
                .attr("y", 9)
                .attr("dy", ".35em")
                .style("text-anchor", "end")
                .text(function (d) { return d; });

            svg.append("svg:image")
            .attr("x", width + 10)
            .attr("y", height - 20)
            .attr("width", 20)
            .attr("height", 20)
            .attr("xlink:href", "Settings.png")
            .on("click", function () { settingsDialog("multiLineChartSettings", true, false); });



    }
    var visOther = function (data, dimensionsX, dimensionsY) {
        for (var i = 0; i < visSettings.dbool.length; i++) {
            if (visSettings.dbool[i]) visSettings.d[i](data,dimensionsX,dimensionsY);
        }



    }

    var visualiseTreeMap = function (data) {
        var root = new TreeMapNode();

        for (var i = 0; i < data.length; i++) {
            var dimensions = [];
            var bool = 1;
            var j = 0;
            while (bool === 1) {
                    
                var dimension = data[i]['x' + j];
                if (dimension) {
                    if (data[i]['xh' + j]) {
                        for (var k = 0; k < data[i]['xh' + j].length; k++) {
                            dimensions.push(data[i]['xh' + j][k]);
                        }
                    }
                    dimensions.push(dimension);
                    j++
                }
                else {
                    bool = 0;
                }
            }
            bool = 1;
            j = 0;
            while (bool === 1) {
                var dimension = data[i]['y' + j];
                if (dimension) {
                    if (data[i]['yh' + j])
                        for (var k = 0; k < data[i]['yh' + j].length; k++) {
                            dimensions.push(data[i]['yh' + j][k]);
                        }
                    dimensions.push(dimension);
                    j++
                }
                else {
                    bool = 0;
                }
            }
            dimensions.unshift("root");
            root.add(data[i].v, dimensions);
            dimensions = null;
           

        }


        TreeMap(root);
    }

    var TreeMap = function (data) {
        var margin = visSettings.treeMapSettings.size;
        var width = margin.width,
        height = margin.height;

 
            
        var color = visSettings.treeMapSettings.color;
        var padding = visSettings.treeMapSettings.padding;
        var treemap = d3.layout.treemap()
            .padding(padding)
            .size([width, height])
            .value(function (d) { return d.value; });

        var svg = d3.select("body").append("svg")
            .attr("settings", "treeMapSettings")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
          .append("g")
            .attr("transform", "translate(-.5,-.5)");

            var cell = svg.data([data]).selectAll("g")
                .data(treemap.nodes)
              .enter().append("g")
                .attr("class", "cell")
                .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

            cell.append("rect")
                .attr("width", function (d) { return d.dx; })
                .attr("height", function (d) { return d.dy; })
                .style("fill", function (d) { return color(d.name) })
                  .on("mouseover", function (d) {
                      tooltip.transition()
                           .duration(200)
                           .style("opacity", .9);
                      tooltip.html(d.name
                        + ": " + d.value)
                           .style("left", (d3.event.pageX + 5) + "px")
                           .style("top", (d3.event.pageY - 28) + "px");
                  })
                  .on("mouseout", function (d) {
                      tooltip.transition()
                           .duration(500)
                           .style("opacity", 0);
                  });


            cell.append("text")
                .attr("x", function (d) { return d.dx / 2; })
                .attr("y", function (d) { return d.dy / 2; })
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(function (d) { return d.children ? null : d.name; });

            svg.append("svg:image")
                .attr("x", width + 10)
                .attr("y", height - 20)
                .attr("width", 20)
                .attr("height", 20)
                .attr("xlink:href", "Settings.png")
                .on("click", function () { settingsDialog("treeMapSettings", true, true); });


    }

    var visualiseParallel = function (data) {

        var ParallelData = $.extend(true, [], data);
        ParallelCoordinates(ParallelData);

    }


    
    var ParallelCoordinates = function (data) {

        var margin = visSettings.parallelCoordinatesSettings.size;
        var width = margin.width,
        height = margin.height;

        var x = d3.scale.ordinal().rangePoints([0, width], 1),
            y = {},
            dragging = {};

        var line = d3.svg.line(),
            axis = d3.svg.axis().orient("left"),
            background,
            foreground;

        var svg = d3.select("body").append("svg")
            .attr("settings", "parallelCoordinatesSettings")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        for (var i = 0; i < data.length; i++) {
            delete data[i]['x'];
            delete data[i]['y'];
            delete data[i]['fv'];
            delete data[i]["tx"];
            delete data[i]["ty"];
        }
        var dimensions;
        x.domain(dimensions = d3.keys(data[0]).filter(function (d) {
            if (d == 'v') return y[d] = d3.scale.linear()
                .domain([0, d3.max(data, function(p) { return p[d]; })])
                .range([height, 0]);
            else
                var domain = [];
                for(var i = 0; i< data.length; i++)
                {
                    domain.push(data[i][d]);
                }
                y[d] = d3.scale.ordinal()
                .domain(domain)
                .rangeRoundBands([height, 0],1);

                var i = 0;
                i++;
                return y[d];
        }));


        foreground = svg.append("g")
            .attr("class", "foreground")
          .selectAll("path")
            .data(data)
          .enter().append("path")
            .attr("d", path);


        var g = svg.selectAll(".dimension")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", function (d) { return "translate(" + x(d) + ")"; });

        g.append("g")
            .attr("class", "axis")
            .each(function (d) { d3.select(this).call(axis.scale(y[d])); })
          .append("text")
            .style("text-anchor", "middle")
            .attr("y", -9)
            .text(function (d) { return d; });



        function position(d) {
            var v = dragging[d];
            return v == null ? x(d) : v;
        }


        function path(d) {
            return line(dimensions.map(function (p) { return [position(p), y[p](d[p])]; }));
        }





    }

    var visualiseHeatMap = function (data, dimensionsX, dimensionsY) {
      
        HeatMap(data, dimensionsX, dimensionsY);
        

    }



    var HeatMap = function (data, dimensionsX, dimensionsY) {
        var margin = visSettings.heatMapSettings.size;
        var width = margin.width,
        height = margin.height;



        d3.scale.ordinal()
            .rangeRoundBands([0, width], .1)
        var x = d3.scale.ordinal().rangeRoundBands([0, width]),
            y = d3.scale.ordinal().rangeRoundBands([height, 0]),
            z = d3.scale.linear().range(["white", "green"]);

            

        var svg = d3.select("body").append("svg")
            .attr("settings","heatMapSettings")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", "0 0" + " " + (width + margin.left + margin.right).toString() + " " + (height + margin.top + margin.bottom).toString())
            .attr("preserveAspectRatio", "xMidYMid")
            .attr("class", "res")
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            //x.domain(data.map(function (d) { return d.x; }));
            x.domain(data.map(function (d) { return d.x; }));
        //y.domain(data.map(function (d) { return d.y; }));
            y.domain(data.map(function (d) { return d.y; }));
            z.domain([0, d3.max(data, function(d) { return d.v; })]);
            
            var xStep = x(dimensionsX[1]) -x(dimensionsX[0]);
            var yStep = y(dimensionsY[0]) - y(dimensionsY[1]);

            //x.domain([x.domain()[0], +x.domain()[1]+ xStep]);
            //y.domain([y.domain()[0], +y.domain()[1] + yStep]);


            svg.selectAll(".tile")
                .data(data)
              .enter().append("rect")
                .attr("class", "tile")
                .attr("x", function(d) { return x(d.x) ; })
                .attr("y", function(d) { return y(d.y); })
                .attr("width", xStep)
                .attr("height", yStep)
                .style("fill", function(d) { return z(d.v); })
                .on("mouseover", function (d) {
                tooltip.transition()
                     .duration(200)
                     .style("opacity", .9);
                tooltip.html(d.x + d.y 
                  + ": " + d.fv)
                     .style("left", (d3.event.pageX + 5) + "px")
                     .style("top", (d3.event.pageY - 28) + "px");

                highlightCell(d.tx, d.ty);
                 })
                .on("mouseout", function (d) {
                tooltip.transition()
                .duration(500)
                .style("opacity", 0);
                highlightCell(d.tx, d.ty);
                 });



            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(d3.svg.axis().scale(x).orient("bottom"))
              .append("text")
                .attr("class", "label")
                .attr("x", width)
                .attr("y", -6);


            svg.append("g")
                .attr("class", "y axis")
                .call(d3.svg.axis().scale(y).orient("left"))
              .append("text")
                .attr("class", "label")
                .attr("y", 6)
                .attr("dy", ".71em");

    }


    var divideTableForVisualisation = function (data) {
        var xAxis = data.axisInfo[0].positions;
        var yAxis = data.axisInfo[1].positions;
        var xDepth = [];
        var xLevelCount = [];
        var yLevelCount = [];
        var yDepth = [];
        var results = [];
        var xCurrent = xDepth[0];
        var yCurrent = yDepth[0];
        
        for (var i = 0; i < xAxis.length; i++) {
            xDepth[i] = xAxis[i].members[0].leveldepth;
            if (xLevelCount[xDepth[i]] === undefined) {
                xLevelCount[xDepth[i]] = 1;
            }
            else {
                xLevelCount[xDepth[i]]++;

            }
        }

        for (var j = 0; j < yAxis.length; j++) {
            yDepth[j] = yAxis[j].members[0].leveldepth;
            if (yLevelCount[yDepth[j]] === undefined) {
                yLevelCount[yDepth[j]] = 1;
            }
            else {
                yLevelCount[yDepth[j]]++;

            }
        }


        var k = 0;
        var results = [];
        var index = [];
        for (var i = 0; i < xLevelCount.length; i++) {
            for (var j = 0; j < yLevelCount.length; j++) {
                if (xLevelCount[i] !== undefined && yLevelCount[j] !== undefined) {
                    results[k] = new subTable(xLevelCount[i], yLevelCount[j]);
                    index[k] = i.toString() + j.toString();
                    k++;
                }


            }
        }
        for(var i = 0; i< xAxis.length; i++) {
            for (var j = 0; j < yAxis.length; j++) {
                var ind = index.indexOf(xDepth[i].toString() + yDepth[j].toString());
                results[ind].add(data.cSet[j*xAxis.length + i].formattedValue);
            }
        }
        

        var ni = document.getElementById('test');
        while (ni.firstChild) {
            ni.removeChild(ni.firstChild);
        }
        for (var i = 0; i < results.length; i++) {
            var html = "<table border=1>";
            for (var j = 0; j < results[i].data[0].length; j++) {
                html = html + "<tr>"
                for (var k = 0; k < results[i].data.length; k++) {
                    html = html + "<td>"+results[i].data[k][j].trim() +"</td>";

                }
                html = html + "</tr>"
            }
            html = html + "</table><br><br>";
            var element = document.createElement("div");
            element.innerHTML = html;
            ni.appendChild(element);
        }

        


        

    }


    function TreeMapNode() {
        var name = "";
        var children = Array(0);
        var value;
    }
    TreeMapNode.prototype.add = function (value, dimensions) {
        var currDim = dimensions.shift();
        if (!this.name ) this.name = currDim;


        if (dimensions.length === 0)
        {
            this.value = value;
            this.name = currDim;
        }
        else
        {
            var added = 0;
            if (this.children) {
                for (var i = 0; i < this.children.length; i++) {
                    if (this.children[i].name === dimensions[0]) {
                        this.children[i].add(value, dimensions);
                        added = 1;
                    }

                }
                if (dimensions.length !== 0 && added === 0) {
                    var child = new TreeMapNode();
                    child.add(value, dimensions);
                    this.children.push(child);
                }
            }
            else {
                if (!dimensions.length !== 0) {
                    var child = new TreeMapNode();
                    child.add(value, dimensions);
                    this.children = [];

                    this.children.push(child);
                }
            }
        }

    }


    var settingsDialog = function (chart, color, padding) {
        $("#dialog-settings").dialog({
            resizable: false,
            modal: true,
            title: "Settings",
            height: 250,
            width: 400,
            create: function (e, ui) {



            },
            open: function () {
                var pane = $(this);
                while (pane[0].firstChild) {
                    pane[0].removeChild(pane[0].firstChild);
                }

                if (color) {
                    var comboBox = $('<select id="colorCombo"></select>');
                    comboBox.append($('<option value="color1">Color A</option>'));
                    comboBox.append($('<option value="color2">Color B</option>'));
                    comboBox.append($('<option value="color3">Color C</option>'));
                    pane.append(comboBox);
                }
                if (padding) {
                    pane.append($("<br>"));
                    var checkBox = $('<input type="checkbox" id="paddingCheck" value="mPadding">');
                    checkBox.prop("checked", (visSettings[chart].padding !== 0));
                    var label = $("<label>Padding</label>");
                    label.append(checkBox);
                    pane.append(label);
                }
            },
            buttons: {
                "Ok": function () {
                    if (color) {
                        var selected = $("#colorCombo :selected").text();
                        switch (selected) {
                            case "Color A":
                                visSettings[chart].color = d3.scale.category10();
                                break;
                            case "Color B":
                                visSettings[chart].color = d3.scale.category20();
                                break;
                            case "Color C":
                                visSettings[chart].color = d3.scale.category20b();

                            default:

                                break;

                        }
                    }

                    if (padding) {
                        var checkBox = $("#paddingCheck").prop("checked");
                        if (checkBox) visSettings[chart].padding = 10;
                        else visSettings[chart].padding = 0;
                    }
                    visualiseData(visSettings.data);
                    $(this).dialog('close');
                },
                "Cancel": function () {
                    $(this).dialog('close');

                }
            }
        });
    }

    var presetDialog = function () {
        $("#dialog-preset").dialog({
            resizable: false,
            modal: true,
            title: "Presets",
            height: 250,
            width: 400,
            create: function (e, ui) {



            },
            open: function () {
                var pane = $(this);
                while (pane[0].firstChild) {
                    pane[0].removeChild(pane[0].firstChild);
                }


                    var comboBox = $('<select id="presetCombo"></select>');
                    comboBox.append($('<option value="presetA">Preset A</option>'));
                    comboBox.append($('<option value="presetB">Preset B</option>'));
                    pane.append(comboBox);
 
            },
            buttons: {
                "Ok": function () {
                    var selected = $("#presetCombo :selected").text();
                    var newSettings;
                        switch (selected) {
                            case "Preset A":
                                newSettings = getNewVisSettings(350,350);

                                
                                break;
                            case "Preset B":
                                newSettings = getNewVisSettings(500, 500);
                                break;


                            default:

                                break;

                            }
                        newSettings.data = visSettings.data;
                        visSettings = newSettings;
                        if(visSettings.enabled && visSettings.data) visualiseData(visSettings.data);
                        $(this).dialog('close');
                    


                },
                "Cancel": function () {
                    $(this).dialog('close');

                }
            }
        });
    }

    var prevColor;
    var highlightCell = function (x, y) {
        var table = $(".jqOlapCube-rtable");

        var row = table[0].children[0].children[table[0].children[0].children.length - y];
        var cell = row.children[row.children.length - x];
        cell = $(cell);
        if (cell.is(".hover")) {
            cell.removeClass("hover");
            cell.css('background-color',prevColor);

        }
        else {
            var classes = cell.attr('class');
            classes =  'hover ' + classes;
            cell.attr('class', classes);
            prevColor = cell.css("background-color");
            cell.css("background-color", "#eee");

        }
    }



})(jQuery);


//---------------------------
