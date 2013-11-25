    var editor = function() {
        var $textaeEditor = this;

        //cursor
        var setupWait = function(self) {
            var wait = function() {
                $textaeEditor.css('cursor', 'wait');
            };
            var endWait = function() {
                $textaeEditor.css('cursor', 'auto');
            };
            self.startWait = wait;
            self.endWait = endWait;
        };

        //load/saveDialog
        var loadSaveDialog = function() {
            var getLoadDialog = function() {
                $body = $("body");
                var $dialog = $body.find("#textae.dialog.load");

                //make unless exists
                if ($dialog.length === 0) {
                    $dialog = $('<div id="textae.dialog.load" title="Load document with annotation.">')
                        .append('<div>Sever :<input type="text" style="width:345px"/><input type="button" value="OK" /></div>')
                        .append('<div>Local :<input type="file"　/></div>');

                    //bind event handler
                    var onFileChange = function() {
                        var reader = new FileReader();
                        reader.onload = function() {
                            var annotation = JSON.parse(this.result);
                            businessLogic.loadAnnotation(annotation);
                            $dialog.dialog("close");
                        };
                        reader.readAsText(this.files[0]);
                    };

                    $body.append($dialog);
                    $dialog.hide();
                    $dialog.find("input[type='file']").on("change", onFileChange);
                    $dialog.find("input[type='button']")
                        .on("click", function() {
                            var url = $dialog.find("input[type='text']").val();
                            businessLogic.getAnnotationFromServer(url);
                            $dialog.dialog("close");
                        });
                }

                return $dialog;
            };
            return {
                showAccess: function(targetUrl) {
                    var $dialog = getLoadDialog();
                    $dialog
                        .find("input[type='text']")
                        .val(targetUrl);
                    $dialog
                        .dialog({
                            resizable: false,
                            width: 550,
                            height: 220,
                            modal: true,
                            buttons: {
                                Cancel: function() {
                                    $(this).dialog("close");
                                }
                            }
                        });
                },
                showSave: function(url, content) {
                    var getSaveDialog = function() {
                        $body = $("body");
                        var $dialog = $body.find("#textae.dialog.save");
                        if ($dialog.length === 0) {
                            $dialog = $('<div id="textae.dialog.save" title="Save document with annotation.">')
                                .append('<div>Sever :<input type="text" style="width:345px"/><input type="button" value="OK" /></div>')
                                .append('<div>Local :<span class="span_link_place"><a target="_blank"/></span></div>');

                            $body.append($dialog);
                            $dialog.hide();
                            $dialog
                                .on("click", "a", function() {
                                    businessLogic.saveAnnotation();
                                    $dialog.dialog("close");
                                })
                                .on("click", "input[type='button']", function() {
                                    var url = $dialog.find("input[type='text']").val();
                                    businessLogic.saveAnnotationToServer(url);
                                    $dialog.dialog("close");
                                });

                        }

                        return $dialog;
                    };

                    var createFileLink = function(contents, $save_dialog) {
                        var $fileInput = getLoadDialog().find("input[type='file']");

                        var file = $fileInput.prop("files")[0];
                        var name = file ? file.name : "annotations.json";
                        var blob = new Blob([contents], {
                            type: 'application/json'
                        });
                        var link = $save_dialog.find('a')
                            .text(name)
                            .attr("href", URL.createObjectURL(blob))
                            .attr("download", name);
                    };

                    var $dialog = getSaveDialog();

                    //create local link
                    createFileLink(content, $dialog);

                    //open dialog
                    $dialog
                        .find("input[type='text']")
                        .val(url);
                    $dialog
                        .dialog({
                            resizable: false,
                            width: 550,
                            height: 220,
                            modal: true,
                            buttons: {
                                Cancel: function() {
                                    $(this).dialog("close");
                                }
                            }
                        });
                }
            };
        }();

        //public to use on textae.js
        setupWait(this);
        this.loadSaveDialog = loadSaveDialog;

        var mode = 'span'; // screen mode: view | span(default) | relation
        var isReplicateAuto = false;

        // selected slements
        var modificationIdsSelected;

        var clipBoard = [];

        // opacity of connectors
        var connOpacity = 0.6;

        // curviness parameters
        var xrate = 0.6;
        var yrate = 0.05;

        // curviness offset
        var c_offset = 20;

        // spanConfig data
        var spanConfig = {
            delimiterCharacters: null,
            nonEdgeCharacters: null,
            defaults: {
                "delimiter characters": [
                    " ",
                    ".",
                    "!",
                    "?",
                    ",",
                    ":",
                    ";",
                    "-",
                    "/",
                    "&",
                    "(",
                    ")",
                    "{",
                    "}",
                    "[",
                    "]",
                    "+",
                    "*",
                    "\\",
                    "\"",
                    "'",
                    "\n",
                    "–"
                ],
                "non-edge characters": [
                    " ",
                    "\n"
                ]
            },
            set: function(config) {
                var settings = $.extend({}, this.defaults, config);

                if (settings['delimiter characters'] !== undefined) {
                    this.delimiterCharacters = settings['delimiter characters'];
                }

                if (settings['non-edge characters'] !== undefined) {
                    this.nonEdgeCharacters = settings['non-edge characters'];
                }
            },
            isNonEdgeCharacter: function(char) {
                return (this.nonEdgeCharacters.indexOf(char) >= 0);
            },
            isDelimiter: function(char) {
                return (this.delimiterCharacters.indexOf(char) >= 0);
            }
        };

        // management data
        var model = function(editor) {
            return {
                sourceDoc: "",
                relationTypes: {},
                relationTypeDefault: "",
                modificationTypes: {},
                modificationTypeDefault: "",
                annotationData: function() {
                    var updateSpanIds = function() {
                        // sort the span IDs by the position
                        var spanIds = Object.keys(model.annotationData.spans); // maintained sorted by the position.
                        var byPosition = function(a, b) {
                            var spans = model.annotationData.spans;
                            return (spans[a].begin - spans[b].begin || spans[b].end - spans[a].end);
                        };
                        spanIds.sort(byPosition);
                        model.annotationData.spanIds = spanIds;
                    };

                    return {
                        spans: null,
                        entities: null,
                        relations: null,
                        spanIds: null,
                        reset: function() {
                            model.annotationData.spans = {};
                            model.annotationData.entities = {};
                            model.annotationData.relations = {};
                        },
                        //expected span is like { "begin": 19, "end": 49 }
                        addSpan: function(span) {
                            var spanId = idFactory.makeSpanId(span.begin, span.end);
                            model.annotationData.spans[spanId] = {
                                begin: span.begin,
                                end: span.end
                            };
                            updateSpanIds();
                        },
                        getSpan: function(spanId) {
                            return model.annotationData.spans[spanId];
                        },
                        removeSpan: function(spanId) {
                            delete model.annotationData.spans[spanId];
                            updateSpanIds();
                        },
                        //expected denotations Array of object like { "id": "T1", "span": { "begin": 19, "end": 49 }, "obj": "Cell" }.
                        parseDenotations: function(denotations) {
                            if (denotations) {
                                denotations.forEach(function(d) {
                                    var span = d.span;
                                    var spanId = idFactory.makeSpanId(span.begin, span.end);
                                    model.annotationData.spans[spanId] = {
                                        begin: span.begin,
                                        end: span.end
                                    };
                                    var entityType = d.obj;
                                    model.annotationData.entities[d.id] = {
                                        span: spanId,
                                        type: entityType
                                    };
                                });
                            }
                            updateSpanIds();
                        },
                        parseRelations: function(relations) {
                            if (relations) {
                                relations.forEach(function(r) {
                                    model.annotationData.relations[r.id] = r;
                                });
                            }
                        },
                        getRelationIds: function() {
                            return Object.keys(model.annotationData.relations);
                        },
                        toJason: function() {
                            var denotations = [];
                            for (var e in model.annotationData.entities) {
                                var span = {
                                    'begin': model.annotationData.spans[model.annotationData.entities[e].span].begin,
                                    'end': model.annotationData.spans[model.annotationData.entities[e].span].end
                                };
                                denotations.push({
                                    'id': e,
                                    'span': span,
                                    'obj': model.annotationData.entities[e].type
                                });
                            }

                            return JSON.stringify({
                                "text": model.sourceDoc,
                                "denotations": denotations
                            });
                        }
                    };
                }(),
                entityTypes: function() {
                    var types = {},
                        defaultType = "",
                        getColor = function() {
                            return this.color ? this.color : "#77DDDD";
                        };

                    return {
                        setDefaultType: function(nameOfEntityType) {
                            defaultType = nameOfEntityType;
                        },
                        getDefaultType: function() {
                            return defaultType || model.entityTypes.getType(model.entityTypes.getSortedNames()[0]).name;
                        },
                        getType: function(nameOfEntityType) {
                            types[nameOfEntityType] = types[nameOfEntityType] || {
                                getColor: getColor
                            };
                            return types[nameOfEntityType];
                        },
                        set: function(newEntityTypes) {
                            // expected newEntityTypes is an array of object. example of object is {"name": "Regulation","color": "#FFFF66","default": true}.
                            types = {};
                            defaultType = "";
                            if (newEntityTypes !== undefined) {
                                newEntityTypes.forEach(function(newEntity) {
                                    newEntity.getColor = getColor;
                                    types[newEntity.name] = newEntity;
                                    if (newEntity.
                                        default === true) {
                                        defaultType = newEntity.name;
                                    }
                                });
                            }
                        },
                        //save number of type, to sort by numer when show entity pallet.
                        incrementNumberOfTypes: function(nameOfEntityType) {
                            //access by square brancket, because nameOfEntityType is user input value, maybe 'null', '-', and other invalid indentifier name.
                            var type = model.entityTypes.getType(nameOfEntityType);
                            type.count = (type.count || 0) + 1;
                        },
                        getSortedNames: function() {
                            //sort by number of types
                            var typeNames = Object.keys(types);
                            typeNames.sort(function(a, b) {
                                return types[b].count - types[a].count;
                            });
                            return typeNames;
                        }
                    };
                }(),
            };
        }(this);

        var modifications;

        var connectors;
        var connectorTypes;

        // index
        var typesPerSpan;
        var entitiesPerType;
        var relationsPerEntity;

        // target URL
        var targetUrl = '';

        // constant values
        var CONSTS = {
            BLOCK_THRESHOLD: 100,
            TYPE_MARGIN_TOP: 18,
            TYPE_MARGIN_BOTTOM: 2,
            PALLET_HEIGHT_MAX: 100
        };

        // will be API of texteaEditor
        startEdit = function(self) {
            var setTypeConfig = function(config) {
                model.entityTypes.set(config['entity types']);

                model.relationTypes = {};
                model.relationTypeDefault = null;
                if (config['relation types'] !== undefined) {
                    var relation_types = config['relation types'];
                    for (var i in relation_types) {
                        model.relationTypes[relation_types[i].name] = relation_types[i];
                        if (relation_types[i]["default"] === true) {
                            model.relationTypeDefault = relation_types[i].name;
                        }
                    }
                    if (!model.relationTypeDefault) {
                        model.relationTypeDefault = relation_types[0].name;
                    }
                }

                connectorTypes = {};

                model.modificationTypes = {};
                model.modificationTypeDefault = null;
                if (config['modification types'] !== undefined) {
                    var mod_types = config['modification types'];
                    for (var j in mod_types) {
                        model.modificationTypes[mod_types[j].name] = mod_types[j];
                        if (mod_types[j]["default"] === true) {
                            model.modificationTypeDefault = mod_types[j].name;
                        }
                    }
                    if (!model.modificationTypeDefault) {
                        model.modificationTypeDefault = mod_types[0].name;
                    }
                }

                if (config.css !== undefined) {
                    $('#css_area').html('<link rel="stylesheet" href="' + config.css + '"/>');
                }
            };

            var initState = function() {
                editHistory.init(editHistoryChanged);
                changeButtonStateReplicate();
                changeButtonStateEntity();
                changeButtonStateDelete();
                changeButtonStatePallet();
                changeButtonStateNewLabel();
                changeButtonStateCopy();
                changeButtonStatePaste();
            };

            renderer.init();
            controller.init();
            initState();

            // read default spanConfig
            spanConfig.set();

            if ($textaeEditor.urlParams.debug) {
                //no file is get from server, if debug.
                var types_for_debug = {
                    "span types": [{
                        "color": "#0000FF",
                        "name": "Protein",
                        "default": true
                    }, {
                        "color": "#FF0000",
                        "name": "Cell"
                    }, {
                        "color": "#00FF00",
                        "name": "Transcription"
                    }, {
                        "color": "#FFFF00",
                        "name": "Gene_expression"
                    }, {
                        "color": "#FF00FF",
                        "name": "Negative_regulation"
                    }, {
                        "color": "#00FFFF",
                        "name": "Positive_regulation"
                    }, {
                        "color": "#FFFF66",
                        "name": "Regulation"
                    }],
                    "relation types": [{
                        "color": "#5CFF0A",
                        "name": "locatedAt"
                    }, {
                        "color": "#FF0000",
                        "name": "themeOf"
                    }, {
                        "color": "#0000FF",
                        "name": "equivalentTo"
                    }]
                };
                setTypeConfig(types_for_debug);
            } else {
                if ($textaeEditor.urlParams.config !== "") {
                    // load sync, because load annotation after load config. 
                    var data = textAeUtil.ajaxAccessor.getSync($textaeEditor.urlParams.config);
                    if (data !== null) {
                        spanConfig.set(data);
                        setTypeConfig(data);

                        businessLogic.getAnnotationFromServer($textaeEditor.urlParams.target);
                    } else {
                        alert('could not read the span configuration from the location you specified.');
                    }
                } else {
                    businessLogic.getAnnotationFromServer($textaeEditor.urlParams.target);
                }
            }
        };

        function setConnectorTypes() {
            for (var name in model.relationTypes) {
                var c = relationColor(name);
                var rgba0 = colorTrans(c, connOpacity);
                var rgba1 = colorTrans(c, 1);

                connectorTypes[name] = {
                    paintStyle: {
                        strokeStyle: rgba0,
                        lineWidth: 1
                    },
                    hoverPaintStyle: {
                        strokeStyle: rgba1,
                        lineWidth: 3
                    }
                };
                connectorTypes[name + '_selected'] = {
                    paintStyle: {
                        strokeStyle: rgba1,
                        lineWidth: 3
                    },
                    hoverPaintStyle: {
                        strokeStyle: rgba1,
                        lineWidth: 3
                    }
                };
            }
        }

        var buttonState = function() {
            var disableButtons = {};

            return {
                enabled: function(button, enable) {
                    if (enable) {
                        delete disableButtons[button];
                    } else {
                        disableButtons[button] = true;
                    }
                    $("body").trigger("textae.editor.buttonState.change", disableButtons);

                    // console.log(button, disableButtons);
                },
                pushed: function(button, push) {
                    $("body").trigger("textae.editor.button.repulicateAuto.push", push);
                    // console.log(button, push);
                }
            };
        }();

        function changeButtonStateEntity() {
            buttonState.enabled("entity", numSpanSelection() > 0);
        }

        function changeButtonStatePallet() {
            buttonState.enabled("pallet", numEntitySelection() > 0);
        }

        function changeButtonStateNewLabel() {
            buttonState.enabled("newLabel", numEntitySelection() > 0);
        }

        function changeButtonStateDelete() {
            buttonState.enabled("delete", numSpanSelection() > 0 || $(".ui-selected").length > 0);
        }

        function changeButtonStateCopy() {
            buttonState.enabled("copy", $(".ui-selected").length > 0);
        }

        function changeButtonStatePaste() {
            buttonState.enabled("paste", clipBoard.length > 0 && numSpanSelection() > 0);
        }

        function changeButtonStateReplicate() {
            buttonState.enabled("replicate", numSpanSelection() == 1);
        }

        // histories of edit to undo and redo.
        var editHistory = function() {
            var lastSaveIndex = -1,
                lastEditIndex = -1,
                history = [],
                onChangeFunc,
                trigger = function() {
                    if (onChangeFunc) {
                        onChangeFunc();
                    }
                };

            return {
                init: function(onChange) {
                    lastSaveIndex = -1;
                    lastEditIndex = -1;
                    history = [];

                    if (onChange !== undefined) {
                        onChangeFunc = onChange.bind(this);
                    }
                    trigger();
                },
                push: function(edits) {
                    history.push(edits);
                    lastEditIndex++;
                    trigger();
                },
                next: function() {
                    lastEditIndex++;
                    trigger();
                    return history[lastEditIndex];
                },
                prev: function() {
                    var lastEdit = history[lastEditIndex];
                    lastEditIndex--;
                    trigger();
                    return lastEdit;
                },
                saved: function() {
                    lastSaveIndex = lastEditIndex;
                    trigger();
                },
                hasAnythingToUndo: function() {
                    return lastEditIndex > -1;
                },
                hasAnythingToRedo: function() {
                    return lastEditIndex < history.length - 1;
                },
                hasAnythingToSave: function() {
                    return lastEditIndex != lastSaveIndex;
                }
            };
        }();

        //action when editHistory is changed.
        var editHistoryChanged = function() {
            var leaveMessage = function() {
                return "There is a change that has not been saved. If you leave now, you will lose it.";
            };

            //change button state
            buttonState.enabled("write", this.hasAnythingToSave());
            buttonState.enabled("undo", this.hasAnythingToUndo());
            buttonState.enabled("redo", this.hasAnythingToRedo());

            //change leaveMessage show
            if (this.hasAnythingToSave()) {
                $(window).off('beforeunload', leaveMessage).on('beforeunload', leaveMessage);
            } else {
                $(window).off('beforeunload', leaveMessage);
            }
        };

        function parseAnnotationJson(data) {
            //validate
            if (data.text === undefined) {
                alert("read failed.");
                return;
            }

            //parse
            model.sourceDoc = data.text;

            model.annotationData.reset();
            model.annotationData.parseDenotations(data.denotations);
            model.annotationData.parseRelations(data.relations);

            entitiesPerType = {};
            typesPerSpan = {};
            relationsPerEntity = {};
            renderer.positions = {};
            connectors = {};

            if (data.denotations !== undefined) {
                data.denotations.forEach(function(d) {
                    //expected d is like { "id": "T1", "span": { "begin": 19, "end": 49 }, "obj": "Cell" }
                    var span = d.span;
                    var spanId = idFactory.makeSpanId(span.begin, span.end);
                    var entityType = d.obj;

                    model.entityTypes.incrementNumberOfTypes(entityType);

                    var tid = idFactory.makeTypeId(spanId, entityType);
                    if (typesPerSpan[spanId]) {
                        if (typesPerSpan[spanId].indexOf(tid) < 0) typesPerSpan[spanId].push(tid);
                    } else {
                        typesPerSpan[spanId] = [tid];
                    }

                    if (entitiesPerType[tid]) {
                        entitiesPerType[tid].push(d.id);
                    } else {
                        entitiesPerType[tid] = [d.id];
                    }
                });
            }

            if (data.relations !== undefined) {
                data.relations.forEach(function(r) {
                    if (!model.relationTypes[r.pred]) {
                        model.relationTypes[r.pred] = {};
                    }

                    if (model.relationTypes[r.pred].count) {
                        model.relationTypes[r.pred].count++;
                    } else {
                        model.relationTypes[r.pred].count = 1;
                    }

                    if (relationsPerEntity[r.subj]) {
                        if (relationsPerEntity[r.subj].indexOf(r.id) < 0) {
                            relationsPerEntity[r.subj].push(r.id);
                        }
                    } else {
                        relationsPerEntity[r.subj] = [r.id];
                    }

                    if (relationsPerEntity[r.obj]) {
                        if (relationsPerEntity[r.obj].indexOf(r.id) < 0) {
                            relationsPerEntity[r.obj].push(r.id);
                        }
                    } else {
                        relationsPerEntity[r.obj] = [r.id];
                    }
                });
            }

            modificationIdsSelected = [];
        }

        var idFactory = function(editor) {
            return {
                // paragraph id
                makeParagraphId: function(index) {
                    return editor.editorId + '__P' + index;
                },
                // span id
                makeSpanId: function(begin, end) {
                    return editor.editorId + '__S' + begin + '_' + end;
                },
                // type id
                makeTypeId: function(sid, type) {
                    return sid + '-' + type;
                },
                makeEntityDomId: function(entityId) {
                    return editor.editorId + '__E' + entityId;
                }
            };
        }(this);

        // render view.
        var renderer = function(editor) {
            var renderEntitiesOfSpan = function(sid) {
                renderGrid(sid);
                for (var t in typesPerSpan[sid]) {
                    var tid = typesPerSpan[sid][t];
                    for (var e in entitiesPerType[tid]) {
                        var eid = entitiesPerType[tid][e];
                        renderer.renderEntity(eid);
                    }
                }
            };

            var renderEntitiesOfSpans = function(sids) {
                renderer.renderSize.mesure();
                sids.forEach(renderEntitiesOfSpan);
            };

            return {
                init: function() {
                    var getArea = function($parent, className) {
                        var $area = editor.find('.' + className);
                        if ($area.length === 0) {
                            $area = $('<div>').addClass(className);
                            $parent.append($area);
                        }
                        return $area;
                    };

                    var initJsPlumb = function() {
                        renderer.jsPlumb = jsPlumb.getInstance({
                            ConnectionsDetachable: false,
                            Endpoint: ["Dot", {
                                radius: 1
                            }]
                        });
                        renderer.jsPlumb.setRenderMode(renderer.jsPlumb.SVG);
                        renderer.jsPlumb.Defaults.Container = editor.getAnnotationArea();
                    };

                    //make view
                    editor.body = getArea(editor, "textae-editor__body");

                    //set method to get Area
                    $.extend(editor, {
                        getSourceDocArea: function() {
                            return getArea(editor.body, "textae-editor__body__text-box");
                        },
                        getAnnotationArea: function() {
                            return getArea(editor.body, 'textae-editor__body__annotation_box');
                        }
                    });

                    initJsPlumb();
                },

                renderAnnotation: function() {
                    var setBodyOffset = function() {
                        //set body offset top half of line space between line of text-box.
                        var $area = editor.getSourceDocArea();
                        $area.html(model.sourceDoc);
                        var lines = $area.get(0).getClientRects();
                        var lineSpace = lines[1].top - lines[0].bottom;
                        editor.find(".textae-editor__body").css("paddingTop", lineSpace / 2);
                        $area.empty();
                    };

                    //souce document has multi paragraphs that are splited by '\n'.
                    var getTaggedSourceDoc = function() {
                        //set sroucedoc tagged <p> per line.
                        return model.sourceDoc.split("\n").map(function(par) {
                            return '<p class="textae-editor__body__text-box__paragraph">' + par + '</p>';
                        }).join("\n");
                    };

                    //paragraphs is Object that has position of charactor at start and end of the statement in each paragraph.
                    var makeParagraphs = function() {
                        var paragraphs = {};
                        var index = 0;
                        var pre_len = 0;
                        editor.getSourceDocArea().find('p').each(function() {
                            var pid = idFactory.makeParagraphId(index);
                            var numberOfCharactors = $(this).text().length;
                            paragraphs[pid] = {
                                begin: pre_len,
                                end: pre_len + numberOfCharactors
                            };
                            pre_len += numberOfCharactors + 1;
                            $(this).attr('id', pid);
                            index++;
                        });
                        return paragraphs;
                    };

                    var renderAllSpan = function() {
                        var sids = model.annotationData.spanIds;
                        var renderedSpans;
                        for (var i = 0; i < sids.length; i++) {
                            renderedSpans = sids.slice(0, i);
                            renderer.renderSpan(sids[i], renderedSpans, renderedSpans.length);
                        }
                    };

                    setConnectorTypes();
                    setBodyOffset();

                    //add source doc
                    var $textBox = editor.getSourceDocArea();
                    $textBox.html(getTaggedSourceDoc());

                    renderer.paragraphs = makeParagraphs();
                    editor.getAnnotationArea().empty();

                    renderAllSpan();
                    renderer.indexPositionSpans(model.annotationData.spanIds);

                    renderEntitiesOfSpans(model.annotationData.spanIds);
                    renderer.relations.renderRelations();
                },
                renderSize: {
                    gridWidthGap: 0,
                    typeHeight: 0,
                    entityWidth: 0,
                    mesure: function() {
                        var div = '<div id="temp_grid" class="grid" style="width:10px; height:auto"></div>';
                        editor.getAnnotationArea().append(div);

                        div = '<div id="temp_type" class="type" title="[Temp] Temp" >T0</div>';
                        $('#temp_grid').append(div);

                        div = '<div id="temp_entity_pane" class="entity_pane"><div id="temp_entity" class="entity"></div></div>';
                        $('#temp_type').append(div);

                        renderer.renderSize.gridWidthGap = $('#temp_grid').outerWidth() - 10;
                        renderer.renderSize.typeHeight = $('#temp_type').outerHeight();
                        renderer.renderSize.entityWidth = $('#temp_entity').outerWidth();
                        $('#temp_grid').remove();
                    }
                },
                createDiv: function(id, cls, top, left, width, height, title) {
                    editor.getAnnotationArea().append('<div id="' + id + '"></div');
                    var div = $('#' + id);
                    div.addClass(cls);
                    div.attr('title', title);
                    div.css('position', 'absolute');
                    div.css('top', top);
                    div.css('left', left);
                    div.css('width', width);
                    div.css('height', height);
                    return id;
                },
                // assume the model.annotationData.spanIds are sorted by the position.
                // when there are embedded model.annotationData.spans, the embedding ones comes earlier then embedded ones.
                renderSpan: function(sid, arguments_spanIds, numOfRenderedSpans) {
                    // console.log(sid, arguments_spanIds);

                    //get the paragraph-id that span is belong to.
                    function getPidBySid(sid) {
                        var span = model.annotationData.getSpan(sid);
                        for (var pid in renderer.paragraphs) {
                            if ((span.begin >= renderer.paragraphs[pid].begin) && (span.end <= renderer.paragraphs[pid].end)) return pid;
                        }
                        return null;
                    }

                    var pid = getPidBySid(sid);
                    var beg = model.annotationData.spans[sid].begin;
                    var end = model.annotationData.spans[sid].end;
                    var len = end - beg;

                    // potision to a new span add 
                    var range = document.createRange();

                    // index of current span
                    var c = arguments_spanIds.indexOf(sid);

                    // c is max if add new span.
                    if (c === -1) {
                        c = numOfRenderedSpans;
                    }

                    // determine the begin node and offset
                    var begnode, begoff;

                    // when there is no preceding span in the paragraph
                    if ((c === 0) || (getPidBySid(arguments_spanIds[c - 1]) != pid)) {
                        var refnode1 = document.getElementById(pid).childNodes[0];
                        if (refnode1.nodeType == 1) {
                            range.setStartBefore(refnode1); // element node
                        } else if (refnode1.nodeType == 3) { // text node
                            begnode = refnode1;
                            begoff = beg - renderer.paragraphs[pid].begin;
                            range.setStart(begnode, begoff);
                        } else {
                            alert("unexpected type of node:" + refnode1.nodeType + ". please consult the developer.");
                        }
                    } else {
                        var p = c - 1; // index of preceding span

                        // when the previous span includes the region
                        if (model.annotationData.spans[arguments_spanIds[p]].end > beg) {
                            var refnode2 = document.getElementById(arguments_spanIds[p]).childNodes[0];
                            if (refnode2.nodeType == 1) range.setStartBefore(refnode2); // element node
                            else if (refnode2.nodeType == 3) { // text node
                                begnode = refnode2;
                                begoff = beg - model.annotationData.spans[arguments_spanIds[p]].begin;
                                range.setStart(begnode, begoff);
                            } else alert("unexpected type of node:" + refnode2.nodeType + ". please consult the developer.");
                        } else {
                            // find the outermost preceding span
                            var pnode = document.getElementById(arguments_spanIds[p]);
                            while (pnode.parentElement &&
                                model.annotationData.spans[pnode.parentElement.id] &&
                                model.annotationData.spans[pnode.parentElement.id].end > model.annotationData.spans[pnode.id].begin &&
                                model.annotationData.spans[pnode.parentElement.id].end < end) {
                                pnode = pnode.parentElement;
                            }

                            begnode = pnode.nextSibling;
                            begoff = beg - model.annotationData.spans[pnode.id].end;
                            range.setStart(begnode, begoff);
                        }
                    }


                    // if there is an embedded span, find the rightmost one.intervening span
                    if ((c < numOfRenderedSpans - 1) && (end > model.annotationData.spans[arguments_spanIds[c + 1]].begin)) {
                        var i = c + 1; // index of the rightmost embedded span

                        // if there is a room for further intervening
                        while (i < numOfRenderedSpans - 1) {
                            // find the next span at the same level
                            var n = i + 1;
                            while ((n < numOfRenderedSpans) && (model.annotationData.spans[arguments_spanIds[n]].begin < model.annotationData.spans[arguments_spanIds[i]].end)) n++;
                            if (n == numOfRenderedSpans) break;
                            if (end > model.annotationData.spans[arguments_spanIds[n]].begin) i = n;
                            else break;
                        }

                        var renode = document.getElementById(arguments_spanIds[i]); // rightmost intervening node
                        if (renode.nextSibling) range.setEnd(renode.nextSibling, end - model.annotationData.spans[arguments_spanIds[i]].end);
                        else range.setEndAfter(renode);
                    } else {
                        // console.log(editor.editorId, range, begnode, begoff + len);
                        range.setEnd(begnode, begoff + len);
                    }

                    var element = document.createElement('span');
                    element.setAttribute('id', sid);
                    element.setAttribute('title', sid);
                    element.setAttribute('class', 'span');
                    range.surroundContents(element);

                    $('#' + sid).off('mouseup', controller.spanClicked).on('mouseup', controller.spanClicked);
                },
                destroySpan: function(sid) {
                    var span = document.getElementById(sid);
                    var parent = span.parentNode;
                    while (span.firstChild) {
                        parent.insertBefore(span.firstChild, span);
                    }
                    parent.removeChild(span);
                    parent.normalize();
                },
                //a circle on Type
                renderEntity: function(eid) {
                    //area has entities and label of type.
                    var renderType = function(entity) {
                        var type = entity.type;
                        var sid = entity.span;
                        var tid = idFactory.makeTypeId(sid, type);

                        var $type = $('#' + tid);
                        if ($type.length === 0) {
                            $type = $('<div id="' + tid + '"></div>');
                            $type.addClass('type');
                            $type.css('background-color', model.entityTypes.getType(type).getColor());
                            $type.css('margin-top', CONSTS.TYPE_MARGIN_TOP);
                            $type.css('margin-bottom', CONSTS.TYPE_MARGIN_BOTTOM);
                            $type.attr('title', type);
                            $type.append('<div id="P-' + tid + '" class="entity_pane"></div>');
                            //label over span
                            $type.append('<div class="type_label">' + type + '</div>');
                            $('#G' + sid).append($type);
                        }

                        return $type;
                    };

                    if (domSelector.getEntity(eid).length === 0) {
                        var entity = model.annotationData.entities[eid];
                        var sid = entity.span;

                        var $entityPane = renderType(entity).find(".entity_pane");

                        var $entity = $('<div id="' + idFactory.makeEntityDomId(eid) + '" class="entity" />');
                        $entity.attr('title', eid);
                        $entity.css('display: inline-block');
                        var type = entity.type;
                        $entity.css('border-color', model.entityTypes.getType(type).getColor());
                        $entity.off('mouseup', controller.entityClicked).on('mouseup', controller.entityClicked);
                        $entityPane.append($entity);

                        positionEntities(sid, type);

                        renderer.indexPositionEntity(eid);
                    }
                },
                indexPositionSpans: function(ids) {
                    for (var i in ids) renderer.indexPositionSpan(ids[i]);
                },
                indexPositionSpan: function(id) {
                    var e = $('#' + id);
                    renderer.positions[id] = {};
                    renderer.positions[id].top = e.get(0).offsetTop;
                    renderer.positions[id].left = e.get(0).offsetLeft;
                    renderer.positions[id].width = e.outerWidth();
                    renderer.positions[id].height = e.outerHeight();
                    renderer.positions[id].center = renderer.positions[id].left + renderer.positions[id].width / 2;
                },
                indexPositionEntities: function() {
                    Object.keys(model.annotationData.entities).forEach(function(id) {
                        renderer.indexPositionEntity(id);
                    });
                },
                indexPositionEntity: function(id) {
                    var gid = 'G' + model.annotationData.entities[id].span;
                    var e = domSelector.getEntity(id);
                    renderer.positions[id] = {};
                    renderer.positions[id].top = renderer.positions[gid].top + e.get(0).offsetTop;
                    renderer.positions[id].left = renderer.positions[gid].left + e.get(0).offsetLeft;
                    renderer.positions[id].width = e.outerWidth();
                    renderer.positions[id].height = e.outerHeight();
                    renderer.positions[id].center = renderer.positions[id].left + renderer.positions[id].width / 2;
                },
            };
        }(this);

        function relationColor(type) {
            if (model.relationTypes && model.relationTypes[type] && model.relationTypes[type].color) return model.relationTypes[type].color;
            return "#555555";
        }

        //handle user input event.
        var controller = function(editor) {
            return {
                //bind user input event to handler
                init: function() {
                    editor.on('mouseup', '.textae-editor__body', controller.doMouseup);
                },
                doMouseup: function(e) {
                    var getPosition = function(node) {
                        // assumption: text_box only includes <p> elements that contains <span> elements that represents model.annotationData.spans.
                        var $parent = $(node).parent();
                        var parentId = $parent.attr("id");

                        var pos;
                        if ($parent.hasClass("textae-editor__body__text-box__paragraph")) {
                            pos = renderer.paragraphs[parentId].begin;
                        } else {
                            pos = model.annotationData.spans[parentId].begin;
                        }

                        var childNodes = node.parentElement.childNodes;
                        for (var i = 0; childNodes[i] != node; i++) { // until the focus node
                            pos += (childNodes[i].nodeName == "#text") ? childNodes[i].nodeValue.length : $('#' + childNodes[i].id).text().length;
                        }

                        return pos;
                    };

                    var getFocusPosition = function(selection) {
                        var pos = getPosition(selection.focusNode);
                        return pos += selection.focusOffset;
                    };

                    var getAnchorPosition = function(selection) {
                        var pos = getPosition(selection.anchorNode);
                        return pos + selection.anchorOffset;
                    };

                    var expandSpan = function(sid, selection) {
                        var edits = [];

                        var focusPosition = getFocusPosition(selection);

                        var range = selection.getRangeAt(0);
                        var anchorRange = document.createRange();
                        anchorRange.selectNode(selection.anchorNode);

                        // expand to the left
                        var new_sid, tid, eid, type;
                        if (range.compareBoundaryPoints(Range.START_TO_START, anchorRange) < 0) {
                            var newBegin = adjustSpanBegin(focusPosition);
                            new_sid = idFactory.makeSpanId(newBegin, model.annotationData.spans[sid].end);
                            if (!model.annotationData.spans[new_sid]) {
                                edits.push({
                                    action: 'new_span',
                                    id: new_sid,
                                    begin: newBegin,
                                    end: model.annotationData.spans[sid].end
                                });

                                typesPerSpan[sid].forEach(function(tid) {
                                    entitiesPerType[tid].forEach(function(eid) {
                                        type = model.annotationData.entities[eid].type;
                                        edits.push({
                                            action: 'remove_denotation',
                                            id: eid,
                                            span: sid,
                                            type: type
                                        });
                                        edits.push({
                                            action: 'new_denotation',
                                            id: eid,
                                            span: new_sid,
                                            type: type
                                        });
                                    });
                                });

                                edits.push({
                                    action: 'remove_span',
                                    id: sid
                                });
                            }
                        }

                        // expand to the right
                        else {
                            var newEnd = adjustSpanEnd(focusPosition);
                            new_sid = idFactory.makeSpanId(model.annotationData.spans[sid].begin, newEnd);
                            if (!model.annotationData.spans[new_sid]) {
                                edits.push({
                                    action: 'new_span',
                                    id: new_sid,
                                    begin: model.annotationData.spans[sid].begin,
                                    end: newEnd
                                });

                                typesPerSpan[sid].forEach(function(tid) {
                                    entitiesPerType[tid].forEach(function(eid) {
                                        type = model.annotationData.entities[eid].type;
                                        edits.push({
                                            action: 'remove_denotation',
                                            id: eid,
                                            span: sid,
                                            type: type
                                        });
                                        edits.push({
                                            action: 'new_denotation',
                                            id: eid,
                                            span: new_sid,
                                            type: type
                                        });
                                    });
                                });
                                edits.push({
                                    action: 'remove_span',
                                    id: sid
                                });
                            }
                        }
                        if (edits.length > 0) makeEdits(edits);
                    };

                    var shortenSpan = function(sid, selection) {
                        var edits = [];

                        var focusPosition = getFocusPosition(selection);

                        var range = selection.getRangeAt(0);
                        var focusRange = document.createRange();
                        focusRange.selectNode(selection.focusNode);

                        // shorten the right boundary
                        var new_sid, tid, eid, type;
                        if (range.compareBoundaryPoints(Range.START_TO_START, focusRange) > 0) {
                            var newEnd = adjustSpanEnd2(focusPosition);

                            if (newEnd > model.annotationData.spans[sid].begin) {
                                new_sid = idFactory.makeSpanId(model.annotationData.spans[sid].begin, newEnd);
                                if (model.annotationData.spans[new_sid]) {
                                    edits.push({
                                        action: 'remove_span',
                                        id: sid
                                    });
                                } else {
                                    edits.push({
                                        action: 'new_span',
                                        id: new_sid,
                                        begin: model.annotationData.spans[sid].begin,
                                        end: newEnd
                                    });
                                    typesPerSpan[sid].forEach(function(tid) {
                                        entitiesPerType[tid].forEach(function(eid) {
                                            type = model.annotationData.entities[eid].type;
                                            edits.push({
                                                action: 'remove_denotation',
                                                id: eid,
                                                span: sid,
                                                type: type
                                            });
                                            edits.push({
                                                action: 'new_denotation',
                                                id: eid,
                                                span: new_sid,
                                                type: type
                                            });
                                        });
                                    });
                                    edits.push({
                                        action: 'remove_span',
                                        id: sid
                                    });
                                }
                            } else {
                                select(sid);
                                businessLogic.removeElements();
                            }
                        }

                        // shorten the left boundary
                        else {
                            var newBegin = adjustSpanBegin2(focusPosition);

                            if (newBegin < model.annotationData.spans[sid].end) {
                                new_sid = idFactory.makeSpanId(newBegin, model.annotationData.spans[sid].end);
                                if (model.annotationData.spans[new_sid]) {
                                    edits.push({
                                        action: 'remove_span',
                                        id: sid
                                    });
                                } else {
                                    edits.push({
                                        action: 'new_span',
                                        id: new_sid,
                                        begin: newBegin,
                                        end: model.annotationData.spans[sid].end
                                    });
                                    typesPerSpan[sid].forEach(function(tid) {
                                        entitiesPerType[tid].forEach(function(eid) {
                                            type = model.annotationData.entities[eid].type;
                                            edits.push({
                                                action: 'remove_denotation',
                                                id: eid,
                                                span: sid,
                                                type: type
                                            });
                                            edits.push({
                                                action: 'new_denotation',
                                                id: eid,
                                                span: new_sid,
                                                type: type
                                            });
                                        });
                                    });
                                    edits.push({
                                        action: 'remove_span',
                                        id: sid
                                    });
                                }
                            } else {
                                select(sid);
                                businessLogic.removeElements();
                            }
                        }
                        if (edits.length > 0) makeEdits(edits);
                    };

                    editor.saySelectMeToTool();

                    var selection = window.getSelection();
                    if (selection) {
                        var range = selection.getRangeAt(0);

                        if (
                            // when the whole div is selected by e.g., triple click
                            (range.startContainer == editor.getSourceDocArea().get(0)) ||
                            // when Shift is pressed
                            (e.shiftKey) ||
                            // when nothing is selected
                            (selection.isCollapsed)
                        ) {
                            // bubbles go up
                            cancelSelect();
                            dismissBrowserSelection();
                            return true;
                        }

                        var anchorPosition = getAnchorPosition(selection);
                        var focusPosition = getFocusPosition(selection);

                        // no boundary crossing: normal -> create a entity
                        var sid;
                        if (selection.anchorNode.parentElement.id === selection.focusNode.parentElement.id) {
                            clearSelection();

                            // switch the position when the selection is made from right to left
                            if (anchorPosition > focusPosition) {
                                var tmpPos = anchorPosition;
                                anchorPosition = focusPosition;
                                focusPosition = tmpPos;
                            }

                            // when the whole text is selected by e.g., triple click (Chrome)
                            if ((anchorPosition === 0) && (focusPosition == model.sourceDoc.length)) {
                                // do nothing. bubbles go up
                                return true;
                            }

                            var beginPosition = adjustSpanBegin(anchorPosition);
                            var endPosition = adjustSpanEnd(focusPosition);
                            sid = idFactory.makeSpanId(beginPosition, endPosition);

                            if (!model.annotationData.spans[sid]) {
                                if (endPosition - beginPosition > CONSTS.BLOCK_THRESHOLD) {
                                    makeEdits([{
                                        action: 'new_span',
                                        id: sid,
                                        begin: beginPosition,
                                        end: endPosition
                                    }]);
                                } else {
                                    var edits = [{
                                        action: 'new_span',
                                        id: sid,
                                        begin: beginPosition,
                                        end: endPosition
                                    }];

                                    if (isReplicateAuto) {
                                        var replicates = getSpanReplicates({
                                            begin: beginPosition,
                                            end: endPosition
                                        });
                                        edits = edits.concat(replicates);
                                    }
                                    if (edits.length > 0) makeEdits(edits);
                                }
                            }
                        }

                        // boundary crossing: exception
                        else {
                            if (selection.anchorNode.parentNode.parentNode == selection.focusNode.parentNode) {
                                clearSelection();
                                expandSpan(selection.anchorNode.parentNode.id, selection);
                            } else if (selection.anchorNode.parentNode == selection.focusNode.parentNode.parentNode) {
                                clearSelection();
                                shortenSpan(selection.focusNode.parentNode.id, selection);
                            } else if (numSpanSelection() == 1) {
                                sid = popSpanSelection();

                                // drag began inside the selected span (expansion)
                                if ((anchorPosition > model.annotationData.spans[sid].begin) && (anchorPosition < model.annotationData.spans[sid].end)) {
                                    // The focus node should be at one level above the selected node.
                                    if ($('#' + sid).get(0).parentNode.id == selection.focusNode.parentNode.id) expandSpan(sid, selection);
                                    else {
                                        select(sid);
                                        alert('A span cannot be expanded to make a boundary crossing.');
                                    }
                                }

                                // drag ended inside the selected span (shortening)
                                else if ((focusPosition > model.annotationData.spans[sid].begin) && (focusPosition < model.annotationData.spans[sid].end)) {
                                    if ($('#' + sid).get(0).id == selection.focusNode.parentNode.id) shortenSpan(sid, selection);
                                    else {
                                        select(sid);
                                        alert('A span cannot be shrinked to make a boundary crossing.');
                                    }
                                } else alert('It is ambiguous for which span you want to adjust the boundary. Reselect the span, and try again.');
                            } else {
                                alert('It is ambiguous for which span you want to adjust the boundary. Select the span, and try again.');
                            }
                        }
                    }

                    dismissBrowserSelection();
                    cancelBubble(e);
                },
                spanClicked: function(e) {
                    presentationLogic.hidePallet();
                    var selection = window.getSelection();
                    var range = selection.getRangeAt(0);

                    // if drag, bubble up
                    if (!selection.isCollapsed) {
                        return true;
                    }

                    var id;
                    if (mode == "span") {
                        id = $(this).attr('id');

                        if (e.ctrlKey) {
                            if (isSelected(e.target)) {
                                deselect(id);
                            } else {
                                select(id);
                            }
                        } else if (e.shiftKey && numSpanSelection() == 1) {
                            var firstId = popSpanSelection();
                            var secondId = $(this).attr('id');

                            dismissBrowserSelection();
                            clearSelection();

                            var firstIndex = model.annotationData.spanIds.indexOf(firstId);
                            var secondIndex = model.annotationData.spanIds.indexOf(secondId);

                            if (secondIndex < firstIndex) {
                                var tmpIndex = firstIndex;
                                firstIndex = secondIndex;
                                secondIndex = tmpIndex;
                            }

                            for (var i = firstIndex; i <= secondIndex; i++) {
                                select(model.annotationData.spanIds[i]);
                            }
                        } else {
                            clearSelection();
                            select(id);
                        }
                    } else if (mode == "relation") {
                        id = $(this).attr('id').split('_')[1]; // in clone area, clone_id

                        renderer.relations.clearRelationSelection();

                        if (numSpanSelection() === 0 && numEntitySelection() === 0) {
                            select(id);
                        } else {
                            // make connection
                            var rid = "R" + (getMaxConnId() + 1);
                            var oid = id;

                            var sid;
                            if (numSpanSelection() > 0) {
                                sid = getSpanSelection();
                            } else {
                                sid = getEntitySelection();
                            }

                            makeEdits([{
                                action: 'new_relation',
                                id: rid,
                                pred: model.relationTypeDefault,
                                subj: sid,
                                obj: oid
                            }]);

                            // star chanining
                            if (e.ctrlKey) {} else {
                                clearSelection();

                                // continuous chaining
                                if (e.shiftKey) {
                                    select(oid);
                                }
                            }
                        }
                    }

                    changeButtonStateReplicate();
                    changeButtonStateEntity();
                    changeButtonStateDelete();
                    changeButtonStatePaste();
                    return false;
                },
                // event handler (entity is clicked)
                entityClicked: function(e) {
                    var id = $(this).attr('id');

                    if (mode == "span") {
                        if (e.ctrlKey) {
                            if (isSelected(e.target)) {
                                deselect(id);
                            } else {
                                select(id);
                            }
                        } else {
                            clearSelection();
                            select(id);
                        }
                    } else if (mode == "relation") {
                        renderer.relations.clearRelationSelection();

                        if (numSpanSelection() === 0 && numEntitySelection() === 0) {
                            selectEntity(id);
                        } else {
                            // make connection
                            var rid = "R" + (getMaxConnId() + 1);
                            var oid = id;

                            var sid;
                            if (numSpanSelection() > 0) {
                                sid = getSpanSelection();
                            } else {
                                sid = getEntitySelection();
                            }

                            makeEdits([{
                                action: 'new_relation',
                                id: rid,
                                pred: model.relationTypeDefault,
                                subj: sid,
                                obj: oid
                            }]);

                            // star chanining
                            if (e.ctrlKey) {} else {
                                clearSelection();

                                // continuous chaining
                                if (e.shiftKey) {
                                    select(oid);
                                }
                            }
                        }
                    }

                    cancelBubble(e);
                    return false;
                },
                gridMouseHover: function(e) {
                    var grid = $(this);
                    var id = grid.attr('id');

                    if (e.type == 'mouseover') {
                        grid.css('height', 'auto');
                        if (grid.outerWidth() < renderer.positions[id].width) grid.css('width', renderer.positions[id].width);
                        // grid.css('z-index', '254');
                    } else {
                        grid.css('height', renderer.positions[id].height);
                        // grid.css('z-index', '');
                    }
                },
                connectorClicked: function(conn, e) {
                    var rid = conn.getParameter("id");

                    clearSelection();

                    if (renderer.relations.isRelationSelected(rid)) {
                        renderer.relations.deselectRelation(rid);
                    } else {
                        if (!e.ctrlKey) {
                            renderer.relations.clearRelationSelection();
                        }
                        renderer.relations.selectRelation(rid);
                    }

                    cancelBubble(e);
                    return false;
                },
            };
        }(this);

        // adjust the beginning position of a span
        function adjustSpanBegin(beginPosition) {
            var pos = beginPosition;
            while (spanConfig.isNonEdgeCharacter(model.sourceDoc.charAt(pos))) {
                pos++;
            }
            while (!spanConfig.isDelimiter(model.sourceDoc.charAt(pos)) && pos > 0 && !spanConfig.isDelimiter(model.sourceDoc.charAt(pos - 1))) {
                pos--;
            }
            return pos;
        }

        // adjust the end position of a span
        function adjustSpanEnd(endPosition) {
            var pos = endPosition;
            while (spanConfig.isNonEdgeCharacter(model.sourceDoc.charAt(pos - 1))) {
                pos--;
            }
            while (!spanConfig.isDelimiter(model.sourceDoc.charAt(pos)) && pos < model.sourceDoc.length) {
                pos++;
            }
            return pos;
        }


        // adjust the beginning position of a span for shortening
        function adjustSpanBegin2(beginPosition) {
            var pos = beginPosition;
            while ((pos < model.sourceDoc.length) && (spanConfig.isNonEdgeCharacter(model.sourceDoc.charAt(pos)) || !spanConfig.isDelimiter(model.sourceDoc.charAt(pos - 1)))) {
                pos++;
            }
            return pos;
        }

        // adjust the end position of a span for shortening
        function adjustSpanEnd2(endPosition) {
            var pos = endPosition;
            while ((pos > 0) && (spanConfig.isNonEdgeCharacter(model.sourceDoc.charAt(pos - 1)) || !spanConfig.isDelimiter(model.sourceDoc.charAt(pos)))) {
                pos--;
            }
            return pos;
        }

        function cancelBubble(e) {
            e = e || window.event;
            e.cancelBubble = true;
            e.bubbles = false;
            if (e.stopPropagation) e.stopPropagation();
        }

        // get the max value of the connector Id
        function getMaxConnId() {
            var maxIdNum = 0;
            for (var rid in model.annotationData.relations) {
                var idNum = parseInt(rid.slice(1));
                if (idNum > maxIdNum) {
                    maxIdNum = idNum;
                }
            }
            return maxIdNum;
        }

        // get the max value of the entity Id
        function getMaxEntityId() {
            var maxIdNum = 0;
            for (var eid in model.annotationData.entities) {
                var idNum = parseInt(eid.slice(1));
                if (idNum > maxIdNum) {
                    maxIdNum = idNum;
                }
            }
            return maxIdNum;
        }

        function cancelSelect(e) {
            // if drag, bubble up
            if (!window.getSelection().isCollapsed) {
                dismissBrowserSelection();
                return true;
            }

            clearSelection();
            renderer.relations.clearRelationSelection();
            clearModificationSelection();
            presentationLogic.hidePallet();
            changeButtonStateReplicate();
            changeButtonStateEntity();
            changeButtonStateDelete();
            changeButtonStatePallet();
            changeButtonStateNewLabel();
            changeButtonStateCopy();
            changeButtonStatePaste();

            $("body").trigger("textae.select.cancel");
        }

        // search same strings
        // both ends should be delimiter characters
        function findSameString(startPos, endPos) {
            var oentity = model.sourceDoc.substring(startPos, endPos);
            var strLen = endPos - startPos;

            var ary = [];
            var from = 0;
            while (true) {
                var sameStrPos = model.sourceDoc.indexOf(oentity, from);
                if (sameStrPos == -1) break;

                if (!isOutsideDelimiter(model.sourceDoc, sameStrPos, sameStrPos + strLen)) {
                    var obj = {};
                    obj.begin = sameStrPos;
                    obj.end = sameStrPos + strLen;

                    var isExist = false;
                    for (var sid in model.annotationData.spans) {
                        if (model.annotationData.spans[sid].begin == obj.begin && model.annotationData.spans[sid].end == obj.end && model.annotationData.spans[sid].category == obj.category) {
                            isExist = true;
                            break;
                        }
                    }

                    if (!isExist && startPos != sameStrPos) {
                        ary.push(obj);
                    }
                }
                from = sameStrPos + 1;
            }
            return ary;
        }

        // check the bondaries: used after replication
        function isOutsideDelimiter(document, startPos, endPos) {
            var precedingChar = document.charAt(startPos - 1);
            var followingChar = document.charAt(endPos);

            if (!spanConfig.isDelimiter(precedingChar) || !spanConfig.isDelimiter(followingChar)) {
                return true;
            } else {
                return false;
            }
        }

        // dismiss the default selection by the browser
        function dismissBrowserSelection() {
            var selection;
            if (window.getSelection) {
                selection = window.getSelection();
                selection.collapse(document.body, 0);
            } else {
                selection = document.selection.createRange();
                selection.setEndPoint("EndToStart", selection);
                selection.select();
            }
        }

        function isSelected(target) {
            return $(target).hasClass('ui-selected');
        }

        function select(id) {
            $('#' + id).addClass('ui-selected');
            changeButtonStatePallet();
            changeButtonStateNewLabel();
            changeButtonStateDelete();
            changeButtonStateCopy();
        }

        function deselect(id) {
            $('#' + id).removeClass('ui-selected');
            changeButtonStatePallet();
            changeButtonStateNewLabel();
            changeButtonStateDelete();
            changeButtonStateCopy();
        }

        function clearSelection() {
            $('.ui-selected').removeClass('ui-selected');
            changeButtonStatePallet();
            changeButtonStateNewLabel();
            changeButtonStateDelete();
            changeButtonStateCopy();
        }

        function numSpanSelection() {
            return $('.span.ui-selected').length;
        }

        function popSpanSelection() {
            var ss = $('.span.ui-selected');
            if (ss.length == 1) {
                ss.removeClass('ui-selected');
                return ss.attr('id');
            } else return null;
        }

        function getSpanSelection() {
            return $('.span.ui-selected').attr('id');
        }

        function selectEntity(eid) {
            domSelector.getEntity(eid).addClass('ui-selected');
        }

        function clearEntitySelection() {
            domSelector.getSelectedEntities().removeClass('ui-selected');
        }

        function numEntitySelection() {
            return domSelector.getSelectedEntities().length;
        }

        function getEntitySelection() {
            return domSelector.getSelectedEntities().attr('title');
        }

        function createModification(pred) {
            var i;

            if (mode == "relation") {
                return;
            } else if (mode == "span") {
                var edits = [];

                var maxIdNum = getMaxModificationId();
                for (i = 0; i < instanceIdsSelected.length; i++) {
                    var iid = instanceIdsSelected[i];
                    if ($('#' + iid + ' .modification.' + pred).length) continue;
                    var mid = "M" + (++maxIdNum);
                    edits.push({
                        action: 'new_modification',
                        id: mid,
                        obj: iid,
                        pred: pred
                    });
                }

                if (edits.length > 0) makeEdits(edits);
            }
        }

        function modificationClicked(e) {
            if (mode == 'span' || mode == 'relation') {
                cancelBubble(e);
                var id = $(this).attr('id');

                if (e.ctrlKey) {
                    if (isModificationSelected(id)) {
                        deselectModification(id);
                    } else {
                        selectModification(id);
                    }
                } else {
                    clearSelection();
                    clearModificationSelection();
                    selectModification(id);
                }
            }
        }


        //user event to edit model
        var businessLogic = {
            loadAnnotation: function(annotation) {
                parseAnnotationJson(annotation);
                editHistory.init();

                renderer.renderAnnotation();
                presentationLogic.showTarget(targetUrl);
            },
            getAnnotationFromServer: function(url) {
                targetUrl = url;
                $textaeEditor.startWait();
                textAeUtil.ajaxAccessor.getAsync(url, businessLogic.loadAnnotation, function() {
                    $textaeEditor.endWait();
                });
            },
            saveAnnotation: function() {
                editHistory.saved();
            },
            saveAnnotationToServer: function(url) {
                $textaeEditor.startWait();
                var postData = model.annotationData.toJason();
                textAeUtil.ajaxAccessor.post(url, postData, presentationLogic.showSaveSuccess, presentationLogic.showSaveError, function() {
                    $textaeEditor.endWait();
                });
            },
            undo: function() {
                clearSelection();
                renderer.relations.clearRelationSelection();
                clearModificationSelection();

                revertEdits(editHistory.prev());
            },

            redo: function() {
                clearSelection();
                renderer.relations.clearRelationSelection();
                clearModificationSelection();

                makeEdits(editHistory.next(), 'redo');

                return false;
            },

            replicate: function() {
                if (numSpanSelection() == 1) {
                    makeEdits(getSpanReplicates(model.annotationData.spans[getSpanSelection()]));
                } else alert('You can replicate span annotation when there is only span selected.');
            },

            toggleReplicateAuto: function() {
                isReplicateAuto = !isReplicateAuto;
                buttonState.pushed("replicate-auto", isReplicateAuto);
            },

            createEntity: function() {
                clearEntitySelection();

                var maxIdNum = getMaxEntityId();
                while (numSpanSelection() > 0) {
                    sid = popSpanSelection();
                    var id = "E" + (++maxIdNum);
                    makeEdits([{
                        action: 'new_denotation',
                        id: id,
                        span: sid,
                        type: model.entityTypes.getDefaultType()
                    }]);
                }
            },

            newLabel: function() {
                var $selectedEntities = domSelector.getSelectedEntities();
                if ($selectedEntities.length > 0) {
                    var new_type = prompt("Please enter a new label", "");

                    var edits = [];
                    $selectedEntities.each(function() {
                        var eid = this.title;
                        console.log(eid);
                        edits.push({
                            action: 'change_entity_type',
                            id: eid,
                            old_type: model.annotationData.entities[eid].type,
                            new_type: new_type
                        });
                    });
                    if (edits.length > 0) makeEdits(edits);
                }
            },

            removeElements: function() {
                var spanRemoves = [];
                $(".span.ui-selected").each(function() {
                    var sid = this.id;
                    spanRemoves.push({
                        action: 'remove_span',
                        id: sid
                    });
                    for (var t in typesPerSpan[sid]) {
                        var tid = typesPerSpan[sid][t];
                        for (var e in entitiesPerType[tid]) {
                            var eid = entitiesPerType[tid][e];
                            selectEntity(eid);
                        }
                    }
                });

                var entityRemoves = [];
                domSelector.getSelectedEntities().each(function() {
                    var eid = this.title;
                    entityRemoves.push({
                        action: 'remove_denotation',
                        id: eid,
                        span: model.annotationData.entities[eid].span,
                        type: model.annotationData.entities[eid].type
                    });
                    for (var r in relationsPerEntity[eid]) {
                        var rid = relationsPerEntity[eid][r];
                        renderer.relations.selectRelation(rid);
                    }
                });

                var relationRemoves = [];
                while (renderer.relations.relationIdsSelected.length > 0) {
                    rid = renderer.relations.relationIdsSelected.pop();
                    relationRemoves.push({
                        action: 'remove_relation',
                        id: rid,
                        subj: model.annotationData.relations[rid].subj,
                        obj: model.annotationData.relations[rid].obj,
                        pred: model.annotationData.relations[rid].pred
                    });
                }

                var modificationRemoves = [];
                while (modificationIdsSelected.length > 0) {
                    mid = modificationIdsSelected.pop();
                    modificationRemoves.push({
                        action: 'remove_modification',
                        id: mid,
                        obj: modifications[mid].obj,
                        pred: modifications[mid].pred
                    });
                }

                var edits = modificationRemoves.concat(relationRemoves, entityRemoves, spanRemoves);

                if (edits.length > 0) makeEdits(edits);
            },

            copyEntities: function() {
                clipBoard.length = 0;
                $(".ui-selected").each(function() {
                    clipBoard.push(this.id);
                });
            },

            pasteEntities: function() {
                var edits = [];
                var maxIdNum = getMaxEntityId();
                while (numSpanSelection() == 1) {
                    sid = popSpanSelection();
                    for (var e in clipBoard) {
                        var id = "E" + (++maxIdNum);
                        edits.push({
                            action: 'new_denotation',
                            id: id,
                            span: sid,
                            type: model.annotationData.entities[clipBoard[e]].type
                        });
                    }
                }
                if (edits.length > 0) makeEdits(edits);
            },

            // set the default type of denoting object
            setEntityTypeDefault: function() {
                model.entityTypes.setDefaultType($(this).attr('label'));
                return false;
            },

            // set the type of an entity
            setEntityType: function() {
                var new_type = $(this).attr('label');
                var edits = [];
                domSelector.getSelectedEntities().each(function() {
                    var eid = this.title;
                    edits.push({
                        action: 'change_entity_type',
                        id: eid,
                        old_type: model.annotationData.entities[eid].type,
                        new_type: new_type
                    });
                });
                if (edits.length > 0) makeEdits(edits);
                return false;
            }
        };

        //user event that does not change data.
        var presentationLogic = function(self) {
            var getMessageArea = function() {
                $messageArea = self.find('.textae-editor__footer .textae-editor__footer__message');
                if ($messageArea.length === 0) {
                    $messageArea = $("<div>").addClass("textae-editor__footer__message");
                    var $footer = $("<div>")
                        .addClass("textae-editor__footer")
                        .append($messageArea);
                    self.append($footer);
                }

                return $messageArea;
            };

            return {
                showTarget: function(targetUrl) {
                    if (targetUrl !== "") {
                        var targetDoc = targetUrl.replace(/\/annotations\.json$/, '');
                        getMessageArea().html("(Target: <a href='" + targetDoc + "'>" + targetDoc + "</a>)");
                    }
                },
                showSaveSuccess: function() {
                    getMessageArea().html("annotation saved").fadeIn().fadeOut(5000, function() {
                        $(this).html('').removeAttr('style');
                        presentationLogic.showTarget(targetUrl);
                    });
                    editHistory.saved();
                    $textaeEditor.endWait();
                },
                showSaveError: function() {
                    getMessageArea.html("could not save").fadeIn().fadeOut(5000, function() {
                        $(this).html('').removeAttr('style');
                        presentationLogic.showTarget(targetUrl);
                    });
                    $textaeEditor.endWait();
                },

                showPallet: function(controlEvent, buttonEvent) {
                    //create table contents for entity type.
                    var makeEntityTypeOfEntityTypePallet = function() {
                        return model.entityTypes.getSortedNames().map(function(t) {
                            var type = model.entityTypes.getType(t);
                            var row = '<tr class="textae-control__entity-pallet__entity-type" style="background-color:' + type.getColor() + '">';

                            row += '<th><input type="radio" name="etype" class="textae-control__entity-pallet__entity-type__radio" label="' + t + '"';
                            row += (t == model.entityTypes.getDefaultType()) ? ' title="default type" checked' : '';
                            row += '/></th>';

                            row += '<td class="textae-control__entity-pallet__entity-type__label" label="' + t + '">' + t + '</td>';

                            row += '<th title="' + uri + '">';

                            var uri = type.uri;
                            if (uri) {
                                row += '<a href="' + uri + '" target="_blank"><img src="images/link.png"/></a>';
                            }

                            row += '</th>';
                            row += '</tr>';
                            return row;
                        }).join();
                    };

                    //return a Pallet that created if not exists.
                    var getEmptyPallet = function() {
                        var $pallet = $('.textae-control__entity-pallet');
                        if ($pallet.length === 0) {
                            //setup new pallet
                            $pallet = $('<div>')
                                .addClass("textae-control__entity-pallet")
                                .append($('<table>'))
                                .css({
                                    'position': 'fixed',
                                    'display': 'none'
                                })
                                .on('mouseup', '.textae-control__entity-pallet__entity-type__radio', businessLogic.setEntityTypeDefault)
                                .on('mouseup', '.textae-control__entity-pallet__entity-type__label', businessLogic.setEntityType);

                            //for show on top append to body.
                            $("body").append($pallet);
                        } else {
                            $pallet.find('table').empty();
                            $pallet.css('width', 'auto');
                        }
                        return $pallet;
                    };

                    var $pallet　 = getEmptyPallet();
                    $pallet.find("table")
                        .append(makeEntityTypeOfEntityTypePallet(model.entityTypes));

                    //limti max height.
                    if ($pallet.outerHeight() > CONSTS.PALLET_HEIGHT_MAX) {
                        $pallet.css('height', CONSTS.PALLET_HEIGHT_MAX);
                        $pallet.css('width', $pallet.outerWidth() + 15);
                    }

                    //if open by mouseevent
                    if (arguments.length === 2) {
                        $pallet.css('top', buttonEvent.clientY - controlEvent.target.offsetTop);
                        $pallet.css('left', buttonEvent.clientX - controlEvent.target.offsetLeft);
                    } else {
                        $pallet.css('top', 10);
                        $pallet.css('left', 20);
                    }
                    $pallet.css('display', 'block');
                },

                hidePallet: function() {
                    $('.textae-control__entity-pallet').css('display', 'none');
                },

                redraw: function() {
                    renderer.indexPositionSpans(model.annotationData.spanIds);
                    positionGrids(model.annotationData.spanIds);

                    renderer.indexPositionEntities();
                    renderer.relations.renewConnections();
                },
            };
        }(this);

        function getSpanReplicates(span) {
            var startPos = span.begin;
            var endPos = span.end;

            var cspans = findSameString(startPos, endPos); // candidate model.annotationData.spans

            var nspans = []; // new model.annotationData.spans
            for (var i = 0; i < cspans.length; i++) {
                cspan = cspans[i];

                // check boundary crossing
                var crossing_p = false;
                for (var sid in model.annotationData.spans) {
                    if (
                        (cspan.begin > model.annotationData.spans[sid].begin && cspan.begin < model.annotationData.spans[sid].end && cspan.end > model.annotationData.spans[sid].end) ||
                        (cspan.begin < model.annotationData.spans[sid].begin && cspan.end > model.annotationData.spans[sid].begin && cspan.end < model.annotationData.spans[sid].end)
                    ) {
                        crossing_p = true;
                        break;
                    }
                }

                if (!crossing_p) {
                    nspans.push(cspan);
                }
            }

            var edits = [];
            for (var j = 0; j < nspans.length; j++) {
                var nspan = nspans[j];
                var id = idFactory.makeSpanId(nspan.begin, nspan.end);
                edits.push({
                    action: "new_span",
                    id: id,
                    begin: nspan.begin,
                    end: nspan.end
                });
            }

            return edits;
        }

        function makeEdits(edits, context) {
            switch (context) {
                case 'undo':
                case 'redo':
                    clearSelection();
                    renderer.relations.clearRelationSelection();
                    break;
                default:
            }
            var tid, arr;

            for (var i in edits) {
                var edit = edits[i];
                switch (edit.action) {
                    // span operations
                    case 'new_span':
                        // model
                        model.annotationData.addSpan({
                            begin: edit.begin,
                            end: edit.end
                        });
                        typesPerSpan[edit.id] = [];
                        // rendering
                        renderer.renderSpan(edit.id, model.annotationData.spanIds, model.annotationData.spanIds.length);
                        renderer.indexPositionSpan(edit.id);
                        // select
                        select(edit.id);
                        break;
                    case 'remove_span':
                        //save span potision for undo
                        var span = model.annotationData.getSpan(edit.id);
                        edit.begin = span.begin;
                        edit.end = span.end;
                        //model
                        model.annotationData.removeSpan(edit.id);
                        delete typesPerSpan[edit.id];
                        //rendering
                        renderer.destroySpan(edit.id);
                        break;

                        // entity operations
                    case 'new_denotation':
                        // model
                        model.annotationData.entities[edit.id] = {
                            id: edit.id,
                            span: edit.span,
                            type: edit.type
                        };
                        tid = idFactory.makeTypeId(edit.span, edit.type);
                        if (typesPerSpan[edit.span].indexOf(tid) < 0) {
                            typesPerSpan[edit.span].push(tid);
                            entitiesPerType[tid] = [];
                            renderGridAsso(edit.span);
                        }
                        entitiesPerType[tid].push(edit.id);
                        // rendering
                        renderer.renderEntity(edit.id);
                        // select
                        selectEntity(edit.id);
                        break;
                    case 'remove_denotation':
                        //model
                        delete model.annotationData.entities[edit.id];
                        tid = idFactory.makeTypeId(edit.span, edit.type);
                        arr = entitiesPerType[tid];
                        arr.splice(arr.indexOf(edit.id), 1);
                        //rendering
                        destroyEntity(edit.id);
                        positionEntities(edit.span, edit.type);
                        // consequence
                        if (entitiesPerType[tid].length === 0) {
                            delete entitiesPerType[tid];
                            arr = typesPerSpan[edit.span];
                            arr.splice(arr.indexOf(tid), 1);
                            destroyType(tid);
                            renderGridAsso(edit.span);
                        }
                        break;
                    case 'change_entity_type':
                        //model
                        model.annotationData.entities[edit.id].type = edit.new_type;
                        //rendering
                        renderer.renderEntity(edit.id);
                        break;

                        // relation operations
                    case 'new_relation':
                        // model
                        model.annotationData.relations[edit.id] = {
                            id: edit.id,
                            subj: edit.subj,
                            obj: edit.obj,
                            pred: edit.pred
                        };
                        if (relationsPerEntity[edit.subj]) {
                            if (relationsPerEntity[edit.subj].indexOf(edit.id) < 0) relationsPerEntity[edit.subj].push(edit.id);
                        } else relationsPerEntity[edit.subj] = [edit.id];

                        if (relationsPerEntity[edit.obj]) {
                            if (relationsPerEntity[edit.obj].indexOf(edit.id) < 0) relationsPerEntity[edit.obj].push(edit.id);
                        } else relationsPerEntity[edit.obj] = [edit.id];
                        // rendering
                        connectors[edit.id] = renderer.relations.renderRelation(edit.id);
                        // selection
                        renderer.relations.selectRelation(edit.id);
                        break;
                    case 'remove_relation':
                        // model
                        delete model.annotationData.relations[edit.id];
                        arr = relationsPerEntity[edit.subj];
                        arr.splice(arr.indexOf(edit.id), 1);
                        if (arr.length === 0) {
                            delete relationsPerEntity[edit.subj];
                        }
                        arr = relationsPerEntity[edit.obj];
                        arr.splice(arr.indexOf(edit.id), 1);
                        if (arr.length === 0) {
                            delete relationsPerEntity[edit.obj];
                        }
                        // rendering
                        renderer.relations.destroyRelation(edit.id);
                        break;
                    case 'change_relation_pred':
                        // model
                        model.annotationData.relations[edit.id].pred = edit.new_pred;
                        // rendering
                        connectors[edit.id].setPaintStyle(connectorTypes[edit.new_pred + "_selected"].paintStyle);
                        connectors[edit.id].setHoverPaintStyle(connectorTypes[edit.new_pred + "_selected"].hoverPaintStyle);
                        connectors[edit.id].setLabel('[' + edit.id + '] ' + edit.new_pred);
                        // selection
                        renderer.relations.selectRelation(edit.id);
                        break;

                        // modification operations
                    case 'new_modification':
                        // model
                        modifications[edit.id] = {
                            id: edit.id,
                            obj: edit.obj,
                            pred: edit.pred
                        };
                        // rendering
                        renderModification(edit.id);
                        break;
                    case 'remove_modification':
                        // model
                        delete modifications[edit.id];
                        // rendering
                        destroyModification(edit.id);
                        break;
                    default:
                        // do nothing
                }
            }

            // update rendering
            presentationLogic.redraw();

            switch (context) {
                case 'undo':
                case 'redo':
                    break;
                default:
                    editHistory.push(edits);
                    changeButtonStateReplicate();
                    changeButtonStateEntity();
                    changeButtonStateDelete();
                    changeButtonStatePallet();
                    changeButtonStateNewLabel();
                    changeButtonStateCopy();
                    changeButtonStatePaste();
            }
        }


        function revertEdits(edits) {
            var redits = [];
            for (var i = edits.length - 1; i >= 0; i--) {
                edit = edits[i];
                var redit = cloneEdit(edit);
                switch (edit.action) {
                    case 'new_span':
                        redit.action = 'remove_span';
                        break;
                    case 'remove_span':
                        redit.action = 'new_span';
                        break;
                    case 'new_denotation':
                        redit.action = 'remove_denotation';
                        break;
                    case 'remove_denotation':
                        redit.action = 'new_denotation';
                        break;
                    case 'change_entity_type':
                        redit.old_type = edit.new_type;
                        redit.new_type = edit.old_type;
                        break;
                    case 'new_relation':
                        redit.action = 'remove_relation';
                        break;
                    case 'remove_relation':
                        redit.action = 'new_relation';
                        break;
                    case 'change_relation_subj':
                        redit.old_subj = edit.new_subj;
                        redit.new_subj = edit.old_subj;
                        break;
                    case 'change_relation_obj':
                        redit.old_obj = edit.new_obj;
                        redit.new_obj = edit.old_obj;
                        break;
                    case 'change_relation_pred':
                        redit.old_pred = edit.new_pred;
                        redit.new_pred = edit.old_pred;
                        break;
                    case 'new_modification':
                        redit.action = 'remove_modification';
                        break;
                    case 'remove_modification':
                        redit.action = 'new_modification';
                        break;
                }
                redits.push(redit);
            }
            makeEdits(redits, 'undo');
        }

        function cloneEdit(e) {
            c = {};
            for (var p in e) {
                c[p] = e[p];
            }
            return c;
        }

        // conversion from HEX to RGBA color
        function colorTrans(color, opacity) {
            var c = color.slice(1);
            var r = c.substr(0, 2);
            var g = c.substr(2, 2);
            var b = c.substr(4, 2);
            r = parseInt(r, 16);
            g = parseInt(g, 16);
            b = parseInt(b, 16);

            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + opacity + ')';
        }

        renderer.relations = function() {
            var determineCurviness = function(sourceId, targetId) {
                var sourceX = renderer.positions[sourceId].center;
                var targetX = renderer.positions[targetId].center;

                var sourceY = renderer.positions[sourceId].top;
                var targetY = renderer.positions[targetId].top;

                var xdiff = Math.abs(sourceX - targetX);
                var ydiff = Math.abs(sourceY - targetY);
                var curviness = xdiff * xrate + ydiff * yrate + c_offset;
                curviness /= 2.4;

                return curviness;
            };

            return {
                renderRelations: function() {
                    var rids = model.annotationData.getRelationIds();
                    renderer.jsPlumb.reset();

                    rids.forEach(function(rid) {
                        connectors[rid] = renderer.relations.renderRelation(rid);
                    });
                    renderer.relations.relationIdsSelected = [];
                },

                //only move position for window.resize.
                renewConnections: function() {
                    var rids = model.annotationData.getRelationIds();

                    rids.forEach(function(rid) {
                        // recompute curviness
                        var sourceId = model.annotationData.relations[rid].subj;
                        var targetId = model.annotationData.relations[rid].obj;
                        var curviness = determineCurviness(sourceId, targetId);

                        if (sourceId == targetId) curviness = 30;

                        var conn = connectors[rid];
                        var label = conn.getLabel();
                        conn.endpoints[0].repaint();
                        conn.endpoints[1].repaint();
                        conn.setConnector(["Bezier", {
                            curviness: curviness
                        }]);
                    });
                },

                renderRelation: function(rid) {
                    var sourceId = model.annotationData.relations[rid].subj;
                    var targetId = model.annotationData.relations[rid].obj;
                    var curviness = determineCurviness(sourceId, targetId);

                    //  Determination of anchor points
                    var sourceAnchor = "TopCenter";
                    var targetAnchor = "TopCenter";

                    // In case of self-reference
                    if (sourceId == targetId) {
                        sourceAnchor = [0.5, 0, -1, -1];
                        targetAnchor = [0.5, 0, 1, -1];
                        curviness = 30;
                    }

                    // make connector
                    var pred = model.annotationData.relations[rid].pred;
                    var rgba = colorTrans(relationColor(pred), connOpacity);
                    var sourceElem = domSelector.getEntity(sourceId);
                    var targetElem = domSelector.getEntity(targetId);

                    var label = '[' + rid + '] ' + pred;

                    var conn = renderer.jsPlumb.connect({
                        source: sourceElem,
                        target: targetElem,
                        anchors: [sourceAnchor, targetAnchor],
                        connector: ["Bezier", {
                            curviness: curviness
                        }],
                        paintStyle: connectorTypes[pred].paintStyle,
                        hoverPaintStyle: connectorTypes[pred].hoverPaintStyle,
                        tooltip: '[' + rid + '] ' + pred,
                        parameters: {
                            "id": rid,
                            "label": label
                        }
                    });

                    conn.addOverlay(["Arrow", {
                        width: 10,
                        length: 12,
                        location: 1
                    }]);
                    conn.setLabel({
                        label: label,
                        cssClass: "label"
                    });
                    conn.bind("click", controller.connectorClicked);
                    return conn;
                },
                isRelationSelected: function(rid) {
                    return (renderer.relations.relationIdsSelected.indexOf(rid) > -1);
                },
                selectRelation: function(rid) {
                    if (!renderer.relations.isRelationSelected(rid)) {
                        connectors[rid].setPaintStyle(connectorTypes[model.annotationData.relations[rid].pred + "_selected"].paintStyle);
                        renderer.relations.relationIdsSelected.push(rid);
                    }
                },
                deselectRelation: function(rid) {
                    var i = renderer.relations.relationIdsSelected.indexOf(rid);
                    if (i > -1) {
                        connectors[rid].setPaintStyle(connectorTypes[model.annotationData.relations[rid].pred].paintStyle);
                        renderer.relations.relationIdsSelected.splice(i, 1);
                    }
                },
                clearRelationSelection: function() {
                    while (renderer.relations.relationIdsSelected.length > 0) {
                        var rid = renderer.relations.relationIdsSelected.pop();
                        connectors[rid].setPaintStyle(connectorTypes[model.annotationData.relations[rid].pred].paintStyle);
                    }
                },
                destroyRelation: function(rid) {
                    var c = connectors[rid];
                    renderer.jsPlumb.detach(c);
                },

            };
        }();

        function isSpanEmbedded(s1, s2) {
            return (s1.begin >= s2.begin) && (s1.end <= s2.end);
        }

        // render the entity pane of a given span and its dependent model.annotationData.spans.
        function renderGridAsso(sid) {
            renderGrid(sid);

            // see if the pane of the parent node needs to be updated
            var pnode = document.getElementById(sid).parentElement;
            while (pnode && pnode.id && model.annotationData.spans[pnode.id]) {
                renderGridAsso(pnode.id);
                pnode = pnode.parentElement;
            }
        }

        function renderGrid(sid) {
            var grid,
                id = 'G' + sid;

            if (typesPerSpan[sid].length < 1) {
                grid = $('#' + id);
                if (grid.length > 0) {
                    grid.remove();
                    delete renderer.positions[id];
                }
                return null;
            } else {
                // decide the offset
                var offset = CONSTS.TYPE_MARGIN_BOTTOM;

                // check the following model.annotationData.spans that are embedded in the current span.
                var c = model.annotationData.spanIds.indexOf(sid);
                for (var f = c + 1;
                    (f < model.annotationData.spanIds.length) && isSpanEmbedded(model.annotationData.spans[model.annotationData.spanIds[f]], model.annotationData.spans[model.annotationData.spanIds[c]]); f++) {
                    var cid = 'G' + model.annotationData.spanIds[f];
                    if (renderer.positions[cid] && ((renderer.positions[cid].offset + renderer.positions[cid].height) < offset)) offset = (renderer.positions[cid].offset + renderer.positions[cid].height) + CONSTS.TYPE_MARGIN_TOP + CONSTS.TYPE_MARGIN_BOTTOM;
                }

                var n = typesPerSpan[sid].length;
                var gridHeight = n * (renderer.renderSize.typeHeight + CONSTS.TYPE_MARGIN_BOTTOM + CONSTS.TYPE_MARGIN_TOP);

                renderer.positions[id] = {};
                renderer.positions[id].offset = offset;
                renderer.positions[id].top = renderer.positions[sid].top - offset - gridHeight;
                renderer.positions[id].left = renderer.positions[sid].left;
                renderer.positions[id].width = renderer.positions[sid].width - renderer.renderSize.gridWidthGap;
                renderer.positions[id].height = gridHeight;

                if ($('#' + id).length === 0) {
                    renderer.createDiv(id, 'grid', renderer.positions[id].top, renderer.positions[id].left, renderer.positions[id].width, renderer.positions[id].height);
                    $('#' + id).off('mouseover mouseout', controller.gridMouseHover).on('mouseover mouseout', controller.gridMouseHover);
                    // $('#' + id).off('mouseup', doNothing).on('mouseup', doNothing);
                } else {
                    grid = $('#' + id);
                    grid.css('top', renderer.positions[id].top);
                    grid.css('left', renderer.positions[id].left);
                    grid.css('width', renderer.positions[id].width);
                    grid.css('height', renderer.positions[id].height);
                }
                return id;
            }
        }

        function positionGrids(sids) {
            console.log(sids);
            for (var s = sids.length - 1; s >= 0; s--) {
                positionGrid(model.annotationData.spanIds[s]);
            }
        }

        function positionGrid(sid) {
            var gid = 'G' + sid;
            var grid = $('#' + gid);
            if (grid.length > 0) {
                renderer.positions[gid].top = renderer.positions[sid].top - renderer.positions[gid].offset - renderer.positions[gid].height;
                renderer.positions[gid].left = renderer.positions[sid].left;
                grid.css('top', renderer.positions[gid].top);
                grid.css('left', renderer.positions[sid].left);
            }
        }

        function destroyType(tid) {
            $('#' + tid).remove();
        }

        var domSelector = {
            getEntity: function(eid) {
                return $('#' + idFactory.makeEntityDomId(eid));
            },
            getSelectedEntities: function() {
                return $('.entity.ui-selected');
            }
        };

        function positionEntities(sid, type) {
            var tid = idFactory.makeTypeId(sid, type);
            $('#P-' + tid).css('left', (renderer.positions['G' + sid].width - (renderer.renderSize.entityWidth * entitiesPerType[tid].length)) / 2);
        }

        function destroyEntity(eid) {
            domSelector.getEntity(eid).remove();
        }

        function renderModifications(mids) {
            for (var i = 0; i < mids.length; i++) {
                renderModification(mids[i]);
            }
        }

        function renderModification(mid) {
            var pred = modifications[mid].pred;
            var oid = modifications[mid].obj;
            var symbol;
            if (pred == "Negation") {
                symbol = 'X';
            } else if (pred == "Speculation") {
                symbol = '?';
            }
            $('#' + oid).append('<entity class="modification" id="' + mid + '">' + symbol + '</entity>');
            $('#' + mid).off('click', modificationClicked).on('click', modificationClicked);
        }


        function destroyModification(mid) {
            $('#' + mid).remove();
        }

        function isModificationSelected(mid) {
            return (modificationIdsSelected.indexOf(mid) > -1);
        }

        function selectModification(mid) {
            if (!isModificationSelected(mid)) {
                $('#' + mid).addClass('selected');
                modificationIdsSelected.push(mid);
            }
        }

        function deselectModification(mid) {
            var i = spanIdsSelected.indexOf(mid);
            if (i > -1) {
                $('#' + mid).removeClass('selected');
                modificationIdsSelected.splice(i, 1);
            }
        }

        function clearModificationSelection() {
            $('modification.selected').removeClass('selected');
            modificationIdsSelected.length = 0;
        }


        function changeConnectionOpacity(opacity) {
            connOpacity = opacity;
            setConnectorTypes();

            for (var rid in model.annotationData.relations) {
                var rtype = model.annotationData.relations[rid].pred;
                connectors[rid].setPaintStyle(connectorTypes[rtype].paintStyle);
            }

            for (var i = 0; i < renderer.relations.relationIdsSelected; i++) {
                var id = renderer.relations.relationIdsSelected[i];
                var type = model.annotationData.relations[id].pred;
                connectors[id].setPaintStyle(connectorTypes[type + "_selected"].paintStyle);
            }
        }

        // public funcitons of editor
        var editorApi = {
            createEntity: businessLogic.createEntity,
            removeElements: businessLogic.removeElements,
            copyEntities: businessLogic.copyEntities,
            pasteEntities: businessLogic.pasteEntities,
            replicate: businessLogic.replicate,
            toggleReplicateAuto: businessLogic.toggleReplicateAuto,
            showPallet: presentationLogic.showPallet,
            showAccess: function() {
                $textaeEditor.loadSaveDialog.showAccess(targetUrl);
            },
            showSave: function() {
                $textaeEditor.loadSaveDialog.showSave(targetUrl, model.annotationData.toJason());
            },
            newLabel: businessLogic.newLabel,
            redo: function() {
                if (editHistory.hasAnythingToRedo()) {
                    businessLogic.redo();
                }
            },
            undo: function() {
                if (editHistory.hasAnythingToUndo()) {
                    businessLogic.undo();
                }
            },
            cancelSelect: cancelSelect,
            selectLeftEntity: function() {
                //TODO presentation logic?
                if (numSpanSelection() == 1) {
                    var spanIdx = model.annotationData.spanIds.indexOf(popSpanSelection());
                    clearSelection();
                    spanIdx--;
                    if (spanIdx < 0) {
                        spanIdx = model.annotationData.spanIds.length - 1;
                    }
                    select(model.annotationData.spanIds[spanIdx]);
                }
            },
            selectRightEntity: function() {
                if (numSpanSelection() == 1) {
                    var spanIdx = model.annotationData.spanIds.indexOf(popSpanSelection());
                    clearSelection();
                    spanIdx++;
                    if (spanIdx > model.annotationData.spanIds.length - 1) {
                        spanIdx = 0;
                    }
                    select(model.annotationData.spanIds[spanIdx]);
                }
            },
            redraw: presentationLogic.redraw,
            start: function() {
                startEdit(self);
            },
            handleInputKey: function(key) {
                var keyApiMap = {
                    "A": editorApi.showAccess,
                    "C": editorApi.copyEntities,
                    "D DEL": editorApi.removeElements,
                    "E": editorApi.createEntity,
                    "Q": editorApi.showPallet,
                    "R": editorApi.replicate,
                    "S": editorApi.showSave,
                    "V": editorApi.pasteEntities,
                    "W": editorApi.newLabel,
                    "X Y": editorApi.redo,
                    "Z": editorApi.undo,
                    "ESC": editorApi.cancelSelect,
                    "LEFT": editorApi.selectLeftEntity,
                    "RIGHT": editorApi.selectRightEntity,
                };
                if (keyApiMap[key]) {
                    keyApiMap[key]();
                }
            },
        };
        this.api = editorApi;

        return this;
    };