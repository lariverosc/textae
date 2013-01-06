$(document).ready(function() {

    /**
     * デバッグ用
     **/
    if (!('console' in window)) {

        window.console = {};
        window.console.log = function(str){
            return str;
        };
    }

    /*
     * css file url
     */
    var cssUrl;


    /*
     * 表示モード、初期値はviewモード
     */
    var mode = 'view';


    /*
     * annotationデータ
     */
    var spans;


    /*
     * 選択されたspan要素
     * 複数の場合があるので配列で表す
     */
    var selectedIds = new Array();

    /*
     * 選択された要素のdoc_area内での順番
     */
    var selectedIdOrder;

    /*
     * 選択されたインスタンス
     */
    var selectedInstanceIds = new Array();

    /*
     * 選択されたmodification
     */
    var selectedModificationIds = new Array();

    /*
     * 選択されたコネクションオブジェクトの配列
     * connection objectが入ります
     */
    var selectedConns = new Array();

    /*
     * multipleで新規作成した時の
     * 不完全な要素のインデックス
     */
    var partialIds = new Array();


    /*
     * ctrlが押されているか
     */
    var isCtrl = false;

    /*
     * ctrl + altが押されているか
     */
    var isCtrlAlt = false;

    /*
     * shiftキーが押されているか
     */
    var isShift = false;

    /*
     * mutipleがonか
     */
    var isMultiple = true;

    /*
     * 接続用span要素
     */
    var sourceElem = null;
    var targetElem = null;


    /*
     * テーブル描画、及びデータ送信用
     * コネクションデータの配列
     * 新規作成で追加,　削除で削除
     */
    var relations;

    /*
     * 一時的に隠すコネクションデータ保存用
     */
    var tmpHidedRelations = new Array();

    /*
     * 線の透明度
     */
    var connOpacity = 0.5;


    /*
     * insannsのデータ
     */
    var insanns;

    var insWidth = 6; // 幅
    var insHeight = 6;  // 高さ
    var insBorder = 3;
    var insMargin = 2;


    /*
     * modannsのデータ
     */
    var modanns;

    /*
     * conf.txtより読み取る設定値
     */
    var delimiterCharacters;
    var nonEdgeCharacters;
    var spanTypes = new Object();
    var relationTypes = new Object();
    var instanceTypes = new Object();
    var modTypes = new Object();
    var spanTypeDefault = "";
    var relationTypeDefault = "";
    var instanceTypeDefault = "";
    var modTypeDefault = "";

    /*
     * 正規表現にて特別な意味をもつ文字
     */
    var metaCharacters = '^$.*+?=!:|\\/()[]{}';

    /*
     * urlのtargetパラメータ
     * text, annotationをGET、POSTするURL
     */
    var targetUrl = '';

    /*
     * doc_area
     */
    var doc_area = document.getElementById('doc_area').getBoundingClientRect();
    var doc_area_left = doc_area.left;
    var doc_area_top  = doc_area.top;

    /*
     * Notice
     */
    function showSource() {
        $('#notice').html("(source: " + targetUrl + ")");
    }

    /*
     * slider初期化
     */
    function initSlider() {

        $('#slider').slider({
            range: "max",
            min: 0,
            max: 10,
            step: 1,
            value: connOpacity*10,
            stop: function( event, ui ) {
                connOpacity = ((ui.value)*0.1).toFixed(1);
                $( "#slider_value" ).html(connOpacity);
                changeConnectionOpacity(connOpacity);
            },
            slide: function( event, ui ) {
                connOpacity = ((ui.value)*0.1).toFixed(1);
                $( "#slider_value" ).html(connOpacity);
            }
        });
        $( "#slider_value" ).html( $("#slider").slider( "value" )*0.1);
    }


    /*
     * urlパラメータの取得
     */
    function getUrlParameters() {
        var params = location.search.replace('?', '').split('&');
        var configUrl = "";

        for(var i in params) {
            var param = params[i];
            if(param.split('=')[0] == 'target') {
                targetUrl = param.split('=')[1];
            }

            if(param.split('=')[0] == 'config') {
                configUrl = param.split('=')[1];
            }
        }

        // read default configuration
        $.ajax({
            type: "GET",
            url: "conf.json",
            dataType: "json",
            async: false,
            success: function(data) {
                setConfig(data);
            },
            error: function() {
                alert("Could not read default configuration. Consult the administrator.");
            }
        });

        if(configUrl != "") {

            //console.log("config が指定されています");
            $.ajax({
                type: "GET",
                url: configUrl,
                dataType: "json",
                crossDomain: true,
                success: function(data) {
                    setConfig(data);
                    renderFrame();
                    loadAnnotation();
                },
                error: function() {
                    alert('could not read the configuration from the location you specified.');
                }
            });
        } else {
            renderFrame();
            loadAnnotation();
        }
    }


    // boundaryであるかどうか
    function searchBoundaryChar(char){
        return $.inArray(char, nonEdgeCharacters);
    }


    // delimiterであるかどうか
    function searchDelimitChar(char){
        return $.inArray(char, delimiterCharacters);
    }


    function renderFrame() {
        tableSpanTypes(spanTypes);
        tableRelationTypes(relationTypes);
        tableInstanceTypes(instanceTypes);
        tableModTypes(modTypes);
        initSlider();
    }


    /*
     * config
     */
    function setConfig(config){
        if (config['delimiter characters'] != undefined) {
            delimiterCharacters = config['delimiter characters'];
        }

        if (config['non-edge characters'] != undefined) {
            nonEdgeCharacters = config['non-edge characters'];
        }

        if (config['span types'] != undefined) {
            var span_types = config['span types'];
            for (var i in span_types) {
                spanTypes[span_types[i]["name"]] = span_types[i];
                if (span_types[i]["default"] == true) {spanTypeDefault = span_types[i]["name"];}
            }
            if (!spanTypeDefault) {spanTypeDefault = span_types[0]["name"];}
        }

        if (config['instance types'] != undefined) {
            var instance_types = config['instance types'];
            for (var i in instance_types) {
                instanceTypes[instance_types[i]["name"]] = instance_types[i];
                if (instance_types[i]["default"] == true) {instanceTypeDefault = instance_types[i]["name"];}
            }
            if (!instanceTypeDefault) {instanceTypeDefault = instance_types[0]["name"];}
        }

        if (config['relation types'] != undefined) {
            var relation_types = config['relation types'];
            for (var i in relation_types) {
                relationTypes[relation_types[i]["name"]] = relation_types[i];
                if (relation_types[i]["default"] == true) {relationTypeDefault = relation_types[i]["name"];}
            }
            if (!relationTypeDefault) {relationTypeDefault = relation_types[0]["name"];}
        }

        if (config['modification types'] != undefined) {
            var mod_types = config['modification types'];
            for (var i in mod_types) {
                modTypes[mod_types[i]["name"]] = mod_types[i];
                if (mod_types[i]["default"] == true) {modTypeDefault = mod_types[i]["name"];}
            }
            if (!modTypeDefault) {modTypeDefault = mod_types[0]["name"];}
        }

        if (config["css"] = undefined) {
            $('#css_area').html('<link rel="stylesheet" href="' + config["css"] + '"/>');
        }
    }

    getUrlParameters();

    /*
     * 操作のundoキュー
     */
    var undoNameArray = new Array();

    /*
     * 操作のredoキュー
     */
    var redoNameArray = new Array();


    /*
     * 各データに対応するundo storage
     */
    var undoCatannsArray = new Array();
    var undoRelannsArray = new Array();
    var undoInsannsArray = new Array();
    var undoModannsArray = new Array();


    /*
     * 各データに対応するredo storage
     */
    var redoCatannsArray = new Array();
    var redoRelannsArray = new Array();
    var redoInsannsArray = new Array();
    var redoModannsArray = new Array();


    /*
     * jsPlumbの初期化
     */
    function initJsPlumb() {
        jsPlumb.reset();

        jsPlumb.setRenderMode(jsPlumb.SVG);
        jsPlumb.Defaults.Container = $("#rel_area");

        jsPlumb.bind("jsPlumbConnection", function(info) {
            //console.log('connection complete!');
        });
    }


    function loadAnnotation() {
        if (!targetUrl) {
            if(sessionStorage.getItem('document') != null) {
                targetUrl = sessionStorage.getItem('targetUrl');
            }
        }

        if (targetUrl) {
            $.ajax({
                type: "GET",
                url: targetUrl,
                dataType: "json",
                crossDomain: true,
                success: function(annotation) {
                    if (annotation.text != undefined) {
                        setAnnotation(annotation);
                    } else {
                        alert("read failed.");
                    }
                },
                error: function(res, textStatus, errorThrown){
                    alert("connection failed.");
                }
            });
        }
    }


    function initialize() {
        undoNameArray = new Array();
        redoNameArray = new Array();
        undoCatannsArray = new Array();
        undoRelannsArray = new Array();
        undoInsannsArray = new Array();
        undoModannsArray = new Array();

        redoCatannsArray = new Array();
        redoRelannsArray = new Array();
        redoInsannsArray = new Array();
        redoModannsArray = new Array();

        changeButtonState($('#undo_btn'), undoNameArray);
        changeButtonState($('#redo_btn'), redoNameArray);
    }


    /*
     * prepare annotation
     */
    function setAnnotation(data) {
        // load annotation
        var doc = data.text;
        $("#src_area").html(doc);

        if(data.catanns != undefined) {
            spans = data.catanns;
        } else {
            spans = new Array();
        }

        if(data.insanns != undefined) {
            insanns = data.insanns;
        } else {
            insanns = new Array();
        }

        if(data.relanns != undefined) {
            relations = data.relanns;
        } else {
            relations = new Array();
        }

        if(data.modanns != undefined) {
            modanns = data.modanns;
        } else {
            modanns = new Array();
        }

        // time setting
        var now = (new Date()).getTime();

        for(var i = 0; i < spans.length; i++) {
            spans[i]["created_at"] = now;
        }

        for(var i = 0; i < insanns.length; i++) {
            insanns[i]["created_at"] = now;
        }

        for(var i = 0; i < relations.length; i++) {
            relations[i]["created_at"] = now;
        }

        for(var i = 0; i < modanns.length; i++) {
            modanns[i]["created_at"] = now;
        }

        // rendering

        renderSpans(spans);
        addCategoryColor(spanTypes);

        renderInstances(insanns);
        addInstypeColor(instanceTypes);

        // distanceをつける
        for(var i in relations) {
            addDistanceToRelation(relations[i]);
        }
        // distanceでソート
        sortConnByDistance(relations);

        // render relations
        initJsPlumb();
        for(var j in relations) {
            var rel = relations[j];
            var color = relationTypes[rel['type']]['color'];
            var rgba = colorTrans(color);
            // modificationなしのrelation
            makeConnection(rel['subject'], rel['object'], rel['type'], rgba, rel['id'], "unselected");
        }

        renderModifications(modanns);
        addModtypeColor(modTypes);

        // storageに格納
        sessionStorage.clear();
        sessionStorage.setItem('document', doc);
        sessionStorage.setItem('targetUrl', targetUrl);
        saveCurrent("catanns_insanns_relanns_modanns");

        initialize();
        tmpHidedRelations = new Array();

        showSource();
        changeMode("view");
    }



    function addDistanceToRelation(conn) {
       // for(var i in relations) {
            //var conn = relations[i];
            var sId = conn['subject'];
            var tId = conn['object'];

            sourceElem = $('#' + sId);
            targetElem = $('#' + tId);

            var sourceX = sourceElem.get(0).offsetLeft;
            var sourceY = sourceElem.get(0).offsetTop;
            var sourceWidth = sourceElem.outerWidth();

            var targetX = targetElem.get(0).offsetLeft;
            var targetY = targetElem.get(0).offsetTop;
            var targetWidth = targetElem.outerWidth();

            // 中央の値
            var source_center;
            var target_center;

            if(sId.substr(0,1) == "T") {
                source_center = sourceX + sourceWidth/2;
            } else {
                source_center = sourceX + insWidth/2;
            }

            if(tId.substr(0,1) == "T") {
                target_center = targetX + targetWidth/2;
            } else {
                target_center = targetX + insWidth/2; // 10はinstanceの幅
            }

            var disX = source_center - target_center;

            var distance = Math.sqrt(disX * disX);
            // console.log(distance, "source:", sId, source_center, "target:", tId, target_center);

            conn['distance'] = distance;

        //}
    }

    function sortConnByDistance(relations) {
        function compare(a, b) {
            return(b['distance'] - a['distance']);
        }
        relations.sort(compare);
    }


    /*
     * spanの表示順番でjsonのソート
     */
    function sortSpans(spans) {
        function compare(a, b) {
            return((a['span']['begin'] - b['span']['begin']) || (b['span']['end'] - a['span']['end']));
        }
        spans.sort(compare);
    }


    /*
     * 現状の保存
     */
    function saveCurrent(name) {
        saveUndoNameStorage(name);

        var names = name.split('_');

        // redoNameを空にする
        redoNameArray.splice(0, redoNameArray.length);

        for(var i = 0; i < names.length; i++) {
            if(names[i] == "catanns") {
                redoCatannsArray.splice(0, redoCatannsArray.length);

                if(spans != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentCatanns') != null && sessionStorage.getItem('currentCatanns') != "undefined") {
                        //console.log('以前のcatannsを取り出します');
                        var prev = loadCurrent(names[i]);
                        saveUndoStorage(prev, names[i]);
                    }

                    sessionStorage.setItem('currentCatanns', JSON.stringify(spans));
                }
            } else if(names[i] == "insanns") {
                redoInsannsArray.splice(0, redoInsannsArray.length);

                if(insanns != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentInsanns') != null && sessionStorage.getItem('currentInsanns') != "undefined") {
                        //console.log('以前のinsannsを取り出します');
                        var prev = loadCurrent(names[i]);
                        saveUndoStorage(prev, names[i]);
                    }
                    sessionStorage.setItem('currentInsanns', JSON.stringify(insanns));
                }

            } else if(names[i] == "relanns") {
                redoRelannsArray.splice(0, redoCatannsArray.length);

                if(relations != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentRelanns') != null && sessionStorage.getItem('currentRelanns') != "undefined") {
                        //console.log('以前のrelannsを取り出します');
                        var prev = loadCurrent(names[i]);
                        saveUndoStorage(prev, names[i]);
                    }
                    sessionStorage.setItem('currentRelanns', JSON.stringify(relations));
                }

            } else if(names[i] == "modanns") {
                redoModannsArray.splice(0, redoModannsArray.length);

                if(modanns != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentModanns') != null && sessionStorage.getItem('currentModanns') != "undefined") {
                        //console.log('以前のmodannsを取り出します');
                        var prev = loadCurrent(names[i]);
                        saveUndoStorage(prev, names[i]);
                    }
                    sessionStorage.setItem('currentModanns', JSON.stringify(modanns));
                }

            }
        }
    }

    /*
     * 現状のロード
     */
    function loadCurrent(name) {
        var str;
        if(name == "catanns") {
            str = sessionStorage.getItem('currentCatanns');
            if(str == null) {
                return new Array();
            } else {
                return JSON.parse(str);
            }
        } else if(name == "insanns") {
            str = sessionStorage.getItem('currentInsanns');
            if(str == null) {
                return new Array();
            } else {
                return JSON.parse(str);
            }
        } else if(name == "relanns") {
            str = sessionStorage.getItem('currentRelanns');
            if(str == null) {
                return new Array();
            } else {
                return JSON.parse(str);
            }
        } else if(name == "modanns") {
            str = sessionStorage.getItem('currentModanns');
            if(str == null) {
                return new Array();
            } else {
                return JSON.parse(str);
            }
        }
    }


    /*
     * 操作名のundo storageへの保存
     */
    function saveUndoNameStorage(name) {
        undoNameArray.push(name);
        sessionStorage.setItem('undoName', JSON.stringify(undoNameArray));
        //console.log(name,'を保存しました');
    }

    /*
     * データのundo storageへの保存
     */
    function saveUndoStorage(ary, name) {

        //undoNameArray.push(name);
        //sessionStorage.setItem('undoName', JSON.stringify(undoNameArray));

        if(name == "catanns") {
            undoCatannsArray.push(ary);
            sessionStorage.setItem('undoCatanns',  JSON.stringify(undoCatannsArray));
        } else if(name == "insanns") {
            undoInsannsArray.push(ary);
            sessionStorage.setItem('undoInsanns',  JSON.stringify(undoInsannsArray));
        } else if(name == "relanns") {
            undoRelannsArray.push(ary);
            sessionStorage.setItem('undoRelanns',  JSON.stringify(undoRelannsArray));
        } else if(name == "modanns") {
            undoModannsArray.push(ary);
            sessionStorage.setItem('undoModanns',  JSON.stringify(undoModannsArray));

        }

        changeButtonState($('#undo_btn'), undoNameArray);
        changeButtonState($('#redo_btn'), redoNameArray);
    }

    /*
     * 操作名のredo storageへの保存
     */
    function saveRedoNameStorage(name) {
        redoNameArray.push(name);
        sessionStorage.setItem('redoName', JSON.stringify(redoNameArray));
    }

    /*
     * データのredo storageへの保存
     */
    function saveRedoStorage(ary, name) {

        // -でばらす
        var names = name.split('_');

        for(var i = 0; i < names.length; i++) {
            if(names[i] == "catanns") {
                redoCatannsArray.push(ary);
                sessionStorage.setItem('redoCatanns',  JSON.stringify(redoCatannsArray));
            } else if(names[i] == "insanns") {
                redoInsannsArray.push(ary);
                sessionStorage.setItem('redoInsanns',  JSON.stringify(redoInsannsArray));
            } else if(names[i] == "relanns") {
                redoRelannsArray.push(ary);
                sessionStorage.setItem('redoRelanns',  JSON.stringify(redoRelannsArray));
            } else if(names[i] == "modanns") {
                redoModannsArray.push(ary);
                sessionStorage.setItem('redoModanns',  JSON.stringify(redoModannsArray));

            }
        }

        /*
        redoArray.push(ary);
        sessionStorage.setItem('redo',  JSON.stringify(redoArray));
        */

        changeButtonState($('#undo_btn'), undoNameArray);
        changeButtonState($('#redo_btn'), redoNameArray);
    }



    /*
     * click undo button
     */
    $('#undo_btn').click(function() {
        // 選択状態は解除
        selectedIds.splice(0, selectedIds.length);
        selectedInstanceIds.splice(0, selectedInstanceIds.length);
        selectedModificationIds.splice(0., selectedModificationIds.length);


        doUndo();
        return false;
    });

    /*
     * click redo button
     */
    $('#redo_btn').click(function(e) {
        // 選択状態は解除
        selectedIds.splice(0, selectedIds.length);
        selectedInstanceIds.splice(0, selectedInstanceIds.length);
        selectedModificationIds.splice(0., selectedModificationIds.length);

        doRedo();
        return false;
    });

    /*
     * Undo
     */
    function doUndo() {

        undoNameArray = JSON.parse(sessionStorage.getItem('undoName'));

        //console.log('以前の操作列：', undoNameArray);

        var undoName = undoNameArray.pop();

        // popしたものを戻す
        sessionStorage.setItem('undoName', JSON.stringify(undoNameArray));

        // redoに操作名を保存
        saveRedoNameStorage(undoName);

        //console.log('以前の操作：', undoName);

        var names = undoName.split('_');

        for(var i in names) {
            var name = names[i];

            if(name == "catanns") {
                //console.log(name,'を操作しました');

                saveRedoStorage(spans, name);

                undoCatannsArray = JSON.parse(sessionStorage.getItem('undoCatanns'));

                //console.log('以前のcatanns列：', undoCatannsArray);

                spans  = undoCatannsArray.pop();

                //console.log('取り出したcatanns:', spans);


                sessionStorage.setItem('currentCatanns', JSON.stringify(spans));
                // popしたものを戻す
                sessionStorage.setItem('undoCatanns', JSON.stringify(undoCatannsArray));

            } else if(name == "relanns") {
                //console.log(name,'を操作しました');

                saveRedoStorage(relations, name);

                undoRelannsArray = JSON.parse(sessionStorage.getItem('undoRelanns'));
                relations = undoRelannsArray.pop();

                sessionStorage.setItem('currentRelanns', JSON.stringify(relations));
                // popしたものを戻す
                sessionStorage.setItem('undoRelanns', JSON.stringify(undoRelannsArray));


            } else if(name == "insanns") {
                //console.log(name,'を操作しました');

                saveRedoStorage(insanns, name);

                undoInsannsArray = JSON.parse(sessionStorage.getItem('undoInsanns'));

                //console.log('以前のcatanns列：', undoInsannsArray);

                insanns = undoInsannsArray.pop();

                sessionStorage.setItem('currentInsanns', JSON.stringify(insanns));
                // popしたものを戻す
                sessionStorage.setItem('undoInsanns', JSON.stringify(undoInsannsArray));

            } else if(name == "modanns") {
                //console.log(name,'を操作しました');

                saveRedoStorage(modanns, name);

                undoModannsArray = JSON.parse(sessionStorage.getItem('undoModanns'));
                modanns = undoModannsArray.pop();

                sessionStorage.setItem('currentModanns', JSON.stringify(modanns));
                // popしたものを戻す
                sessionStorage.setItem('undoModanns', JSON.stringify(undoModannsArray));

            }
        }

        if(undoNameArray.length == 0) {
            $('#undo_btn').prop("disabled", true);
            $('#undo_btn').css('opacity', 0.3);
        }

        renderSpans(spans);
        addCategoryColor(spanTypes);

        renderInstances(insanns);
        addInstypeColor(instanceTypes);

        jsPlumb.reset();

        for(var j in relations) {
            var rel = relations[j];
            var color = relationTypes[rel['type']]["color"];
            var rgba = colorTrans(color);
            // modificationなしのrelation
            makeConnection(rel['subject'], rel['object'], rel['type'], rgba, rel['id'], "unselected");
        }

        renderModifications(modanns);
        addModtypeColor(modTypes);

        //console.log('undo操作後');
        //console.log('undoNameArray:', undoNameArray);
        //console.log('redoNameArray:', redoNameArray);
    }

    /*
     * Redo
     */
    function doRedo() {
        redoNameArray = JSON.parse(sessionStorage.getItem('redoName'));

        var redoName = redoNameArray.pop();

        //console.log('戻す操作列：', redoNameArray);
        //console.log('戻す操作：', redoName);

        saveUndoNameStorage(redoName);

        // popしたものを戻す
        sessionStorage.setItem('redoName', JSON.stringify(redoNameArray));

        var names = redoName.split('_');

        for(var i in names) {

            var name = names[i];

            if(name == "catanns") {
                //console.log(name,'を戻します------');

                redoCatannsArray = JSON.parse(sessionStorage.getItem('redoCatanns'));
                spans  = redoCatannsArray.pop();

                //console.log('--もどしたspans:', spans);

                if(spans != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentCatanns') != null && sessionStorage.getItem('currentCatanns') != "undefined") {
                        //console.log('以前のcatannsを取り出します');
                        var prev = loadCurrent("catanns");
                        saveUndoStorage(prev, name);
                    }

                    sessionStorage.setItem('currentCatanns', JSON.stringify(spans));

                    // popしたものを戻す
                    sessionStorage.setItem('redoCatanns', JSON.stringify(redoCatannsArray));
                }

            } else if(name == "relanns") {
                //console.log(name,'を操作しました');
                redoRelannsArray = JSON.parse(sessionStorage.getItem('redoRelanns'));
                relations = redoRelannsArray.pop();

                if(relations != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentRelanns') != null && sessionStorage.getItem('currentRelanns') != "undefined") {
                        //console.log('以前のrelannsを取り出します');
                        var prev = loadCurrent("relanns");
                        saveUndoStorage(prev, name);
                    }
                    sessionStorage.setItem('currentRelanns', JSON.stringify(relations));

                    // popしたものを戻す
                    sessionStorage.setItem('redoRelanns', JSON.stringify(redoRelannsArray));
                }

            } else if(name == "insanns") {
                //console.log(name,'を操作しました');
                redoInsannsArray = JSON.parse(sessionStorage.getItem('redoInsanns'));
                insanns = redoInsannsArray.pop();

                if(insanns != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentInsanns') != null && sessionStorage.getItem('currentInsanns') != "undefined") {
                        //console.log('以前のinsannsを取り出します');
                        var prev = loadCurrent("insanns");
                        saveUndoStorage(prev, name);
                    }
                    sessionStorage.setItem('currentInsanns', JSON.stringify(insanns));

                    // popしたものを戻す
                    sessionStorage.setItem('redoInsanns', JSON.stringify(redoInsannsArray));
                }

            } else if(name == "modanns") {
                //console.log(redoName,'を操作しました');
                redoModannsArray = JSON.parse(sessionStorage.getItem('redoModanns'));
                modanns = redoModannsArray.pop();

                if(modanns != undefined) {
                    //前の状態を取り出して、それをundoStorageに保存する
                    if(sessionStorage.getItem('currentModanns') != null && sessionStorage.getItem('currentModanns') != "undefined") {
                        //console.log('以前のmodannsを取り出します');
                        var prev = loadCurrent("modanns");
                        saveUndoStorage(prev, name);
                    }
                    sessionStorage.setItem('currentModanns', JSON.stringify(modanns));

                    // popしたものを戻す
                    sessionStorage.setItem('redoModanns', JSON.stringify(redoModannsArray));
                }
            }
        }


        //sessionStorage.setItem('redo', JSON.stringify(redoArray));

        if(undoNameArray.length == 0) {
            $('#redo_btn').prop("disabled", true);
            $('#redo_btn').css('opacity', 0.3);
        }

        renderSpans(spans);
        addCategoryColor(spanTypes);

        renderInstances(insanns);
        addInstypeColor(instanceTypes);

        jsPlumb.reset();

        for(var j in relations) {
            var rel = relations[j];
            var color = relationTypes[rel['type']]["color"];
            var rgba = colorTrans(color);
            // modificationなしのrelation
            makeConnection(rel['subject'], rel['object'], rel['type'], rgba, rel['id'], "unselected");
        }

        renderModifications(modanns);
        addModtypeColor(modTypes);
    }


    /*
     * undo, redoのボタン状態を変更
     */
    function changeButtonState(elem, array) {
        if(array.length == 0) {
            elem.prop("disabled", true);
            elem.css('opacity', 0.3);
        } else {
            elem.prop("disabled", false);
            elem.css('opacity', 1.0);
        }
    }


    /*
     * Category リストの作成
     */
    function tableSpanTypes(spanTypes) {
        var html = '<form><table>';
        html += '<tr><th colspan="2">Span Types</th>';

        for(var s in spanTypes) {
            var uri = spanTypes[s]["uri"];

            html += '<tr style="background-color:' + spanTypes[s]["color"]  + '">';

            if (s == spanTypeDefault) {
                html += '<td><input type="radio" name="category" class="category_radio" checked title="default type"></td>';
            } else {
                html += '<td><input type="radio" name="category" class="category_radio"></td>';
            }

            html += '<td class="category_apply_btn">' + s  + '</td>';

            if (uri) {
                html += '<td title="' + uri + '">' + '<a href="' + uri + '" target="_blank"><img src="images/link.png"></a></td>';
            }

            html += '</tr>';
        }

        html += '</table></form>';
        $('#span_types').html(html);
    }


    /*
     * Relation Categoryリストの作成
     */
    function tableRelationTypes (relationTypes) {
        var html = '<form><table>';
        html += '<tr class="hide_all_checkbox">' +
            '<th colspan="2">Relation Types</th>' +
            '<td><input type="checkbox" name="rel_hide" class="rel_hide" title="all" checked></td>' +
            '</tr>';

        for (var r in relationTypes) {
            var uri = relationTypes[r]["uri"];
            var color = relationTypes[r]["color"];

            html += '<tr style="background-color:' + color  + '">';

            if(r == relationTypeDefault) {
                html += '<td><input type="radio" name="relation" class="relation_radio" checked title="default type"></td>';
            } else {
                html += '<td><input type="radio" name="relation" class="relation_radio"></td>';
            }

            html += '<td class="relation_apply_btn">' + r  + '</td>';
            html += '<td><input type="checkbox" name="rel_hide" class="rel_hide" title="show/hide" checked></td>';

            if (uri) {
                html += '<td title="' + uri + '">' + '<a href="' + uri + '" target="_blank"><img src="images/link.png"></a></td>';
            }

            html += '</tr>';

            var obj = new Object();
            obj[r] = {paintStyle:{strokeStyle:color, lineWidth:2}};
            jsPlumb.registerConnectionTypes(obj);
        }

        html += '</table></form>';

        $('#relation_list').html(html);
    }


    /*
     * Instance Typeリストの作成
     */
    function tableInstanceTypes(instanceTypes) {
        var html = '<form><table><tr class="hide_all_checkbox">' +
            '<th colspan="2">Instance Types</th>' +
            '<td><input type="checkbox" name="instype_hide" class="instype_hide" title="all" checked></td>' +
            '<td></td>' +
            '</tr>';

        for(var i in instanceTypes) {
            var uri = instanceTypes[i]["uri"];

            html += '<tr style="background-color:' + instanceTypes[i]["color"]  + '">';

            if (i == instanceTypeDefault) {
                html += '<td><input type="radio" name="instype" class="instype_radio" checked title="default type"></td>';
            } else {
                html += '<td><input type="radio" name="instype" class="instype_radio"></td>';
            }

            html += '<td class="instype_apply_btn">' + i  + '</td>';
            html += '<td><input type="checkbox" name="instype_hide" class="instype_hide" title="show/hide" checked></td>';

            if (uri) {
                html += '<td title="' + uri + '">' + '<a href="' + uri + '" target="_blank"><img src="images/link.png"></a></td>';
            }

            html += '</tr>';
        }

        html += '</table></form>';

        $('#instype_list').html(html);
    }


    /*
     * Modification Typeリストの作成
     */
    function tableModTypes(modTypes) {
        var html = '<form><table><tr class="hide_all_checkbox">' +
            '<th colspan="2">Modification Types</th>' +
            '<td><input type="checkbox" name="modtype_hide" class="modtype_hide" title="all" checked></td>' +
            '<td></td>' +
            '</tr>';

        for(var m in modTypes) {
            var uri = modTypes[m]["uri"];

            html += '<tr style="background-color:' + modTypes[m]["color"] + '">'

            if (m == modTypeDefault) {
                html += '<td><input type="radio" name="modtype" class="modtype_radio" checked title="default type"></td>';
            } else {
                html += '<td><input type="radio" name="modtype" class="modtype_radio"></td>';

            }

            html += '<td class="modtype_apply_btn">' + m  + '</td>';
            html += '<td><input type="checkbox" name="modtype_hide" class="modtype_hide" title="show/hide" checked></td>';

            if (uri) {
                html += '<td title="' + uri + '">' + '<a href="' + uri + '" target="_blank"><img src="images/link.png"></a></td>';
            }

            html += '</tr>';
        }

        html += '</table></form>';

        $('#modtype_list').html(html);
    }


    /*
     * 現在表示されているコネクションデータを取得
     * 非表示のものは取得しません
     */
    function getConnectionData() {

        var conns = new Array();

        // connectionListを取得
        var connectionList = jsPlumb.getConnections();

        if(connectionList != undefined){

            //console.log('connectionList数:', connectionList.length);

            for(var i in connectionList) {
                var sourceId = connectionList[i].sourceId;
                var targetId = connectionList[i].targetId;
                var paintStyle = connectionList[i].paintStyleInUse;
                var connId = connectionList[i].getParameter("connId");
                var type = connectionList[i].getParameter("type");
                var endpoints = connectionList[i].endpoints;
                var overlays = connectionList[i].overlays;

               // console.log('overlays:', overlays);

                // 詰め替え
                var connObj = new Object();
                connObj["subject"] = sourceId;
                connObj["object"] = targetId;
                connObj["paintStyle"] = paintStyle['strokeStyle'];
                connObj["id"] = connId;

                connObj["type"] = type;
                connObj["endpoints"] = endpoints;

                connObj["overlays"] = overlays;
                conns.push(connObj);
            }
        }
        return conns;
    }

    /*
     * doc_area部分の描画
     * textにアノテーションマークをつける
     */
    function renderSpans(spans) {
        // かならず数字順
        sortSpans(spans);

        $("#doc_area").html($("#src_area").html());

        var origNode = document.getElementById("doc_area").childNodes[0];

        var newHtml = "";

        // 各アノテーションに対して、範囲とアノテーションを取得し、
        // それを<span>タグに直して表示する
        // annJson: アノテーションJson
        // beforeNode: spanタグで分割するノード
        // splitPos: ノードの中で文字列を分割する位置
        function makeSpan(spans, beforeNode, maxEndPos) {
            var lastStartPos = 0;
            var lastEndPos = 0;

            $.each(spans, function(i, ann) {

                // ここがプラスの場合
                // 一番上の親の連続したマークになる
                if(ann['span']['begin'] - maxEndPos >= 0) {

                    var afterNode = beforeNode.splitText(ann['span']['begin'] - maxEndPos);
                    //console.log("afterNode:", afterNode); // 分割点より後のテキスト
                    //console.log("beforeNode:", beforeNode);  // 分割点より前のテキスト

                    // range文字列の長さ
                    var len = ann['span']['end'] - ann['span']['begin'];
                    // console.log('len:', ann['end'], '-', ann['begin'], '=',len)

                    var range = document.createRange();
                    range.setStart(afterNode, 0);
                    range.setEnd(afterNode, len);

                    var label = ann['category'];
                    var id = ann['id'];

                    // spanタグで囲んだ部分を分割
                    var newNode = afterNode.splitText(len);

                    var span = document.createElement("span");
                    span.setAttribute('class', label);
                    span.setAttribute('id', id);
                    span.setAttribute('title', '[' + id + '] ' + label);
                    if (spanTypes[label]["region"] != true) {
                        span.setAttribute('style', 'white-space:pre');
                    }

                    range.surroundContents(span);

                    // 切り取った長さ
                    maxEndPos = ann['span']['end'];

                    beforeNode = newNode;

                    // 最後に追加したspan要素
                    lastStartPos = ann['span']['begin'];
                    lastEndPos = ann['span']['end'];

                } else {
                    //console.log("****************直前のjsonノードの中に子供spanとして存在する*********");
                    // マイナスの場合は
                    // 直前のjsonノードの中に子供spanとして存在する
                    var baseNode = document.getElementById("doc_area");

                    // nodeを分解して、足して得た文字列の長さ
                    var textLength = 0;

                    function findNode(baseNode) {
                        var childs = baseNode.childNodes;

                        for(var i = 0; i < childs.length; i++) {
                            if(childs[i].nodeName == 'SPAN') {
                                var node = findNode(childs[i]);
                                if(node != undefined ) {
                                    return node;
                                    break;
                                }
                            } else {
                                // console.log("text:", childs[i].nodeValue);

                                if(ann['span']['begin'] >= textLength && ann['span']['begin'] < textLength + childs[i].nodeValue.length ) {
                                    //console.log('このノードの中にあります:', childs[i].nodeValue);

                                    // range文字列の長さ
                                    //var len = ann['end'] - ann['begin'];
                                    //console.log('len:', ann[1], '-', ann[0], '=',len)

                                    var range = document.createRange();
                                    range.setStart (childs[i], ann['span']['begin'] - textLength);
                                    range.setEnd (childs[i], ann['span']['end'] - textLength);

                                    var label = ann['category'];
                                    var id = ann['id'];

                                    var span = document.createElement("span");
                                    span.setAttribute('class', label);

                                    span.setAttribute('id', id);
                                    span.setAttribute('title', label);

                                    range.surroundContents(span);

                                    return childs[i];
                                    break;
                                }
                                textLength += childs[i].nodeValue.length;
                            }
                        }
                    }
                    var node = findNode(baseNode);
                }

            });
        }

        makeSpan(spans, origNode, 0);


        for(i in selectedIds) {
            $('span#' + selectedIds[i]).addClass('selected');
        }

        // 不完全要素の枠をつける
        //console.log('partialIds.length:', partialIds.length);
        for(i in partialIds) {
            //console.log('partialIds[i]:', partialIds[i]);
            $('span#' + partialIds[i]).addClass('partial').addClass('selected').addClass('partialSelected');
        }

        // 不完全要素があることを警告する
        if(partialIds.length > 0) {
            var notice = partialIds.length + ' incomplete annotation element! <img src="images/notice_ok_btn.png " alt="notice_ok" id="notice_ok_btn" >';
            $('#notice').html(notice);
        }

        // 不完全要素を空にする
        partialIds.splice(0, partialIds.length);
    }


    /*
     * textにcategoryに対応する色をつけます
     */
    function addCategoryColor(spanTypes) {
        for(var s in spanTypes) {
            $('span.' + s).css('background-color', spanTypes[s]["color"]);
        }
    }

    /*
     * instance listにinstypeに対応する色をつけます
     */
    function addInstypeColor(instanceTypes) {
        for (var i in instanceTypes) {
            $('.' + i).css('background-color', instanceTypes[i]["color"]);
        }
    }

    /*
     * instanceの枠にcategoryに対応する色をつけます
     */
    function addInstanceBorderColor(elem, spanTypes) {
        for (var s in spanTypes) {
            if (elem.hasClass(s)) {
                elem.css('border-color', spanTypes[s]["color"]);
                break;
            }
        }
    }


    /*
     * modification listにmodtypeに対応する色をつけます
     */
    function addModtypeColor(modTypes) {
        for(var m in modTypes) {
            $('.mod_' + m).css('color', modTypes[m]['color']);
        }
    }


    /*
     * Categoryのデフォルト値の変更
     */
    $('.category_radio').live('change', function() {
        spanTypeDefault = $(this).parent().next().text();
    });

    /*
     * Relation Categoryのデフォルト値の変更
     */
    $('.relation_radio').live('change', function() {
        relationTypeDefault = $(this).parent().next().text();
    });


    /*
     * relationの表示非表示
     */
    $('.rel_hide').live("change", function(e) {
        //console.log("rel_hide:", $(this).attr('checked'));
        //console.log('relation type:', $(this).parent().prev().text());
        // relation type
        //var relType = $(this).parent().prev().text();

        var relType = $(this).attr('title');

        //console.log('relType:', relType);

        if($(this).attr('checked') == undefined) {

            //console.log("チェックはずれました")

            var conns = getConnectionData();

            if(relType != "all") {

                // tmpHidedrelationsに移動
                for(var i in conns) {

                    //console.log('rel_type:', conns[i].type);
                    if(conns[i]["type"] == relType) {

                        var connId = conns[i]["id"];
                        var endpoints = conns[i]["endpoints"];

                        tmpHidedRelations.push(conns[i]);

                        // テーブルの背景を薄くする
                        $('#relation_t_' + connId).addClass('tmp_hide');
                        $('#relation_t_' + connId).removeClass('t_selected');
                        $('#relation_t_' + connId + ' .removeBtn').hide();

                        // 削除
                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);
                    }

                }
            } else {

                $('.rel_hide').removeAttr('checked');

                // すべて隠す
                for(var i in conns) {
                    var connId = conns[i]["id"];
                    var endpoints = conns[i]["endpoints"];

                    tmpHidedRelations.push(conns[i]);

                    // テーブルの背景を薄くする
                    $('#relation_t_' + connId).addClass('tmp_hide');
                    $('#relation_t_' + connId).removeClass('t_selected');
                    $('#relation_t_' + connId + ' .removeBtn').hide();

                    // 削除
                    jsPlumb.deleteEndpoint(endpoints[0]);
                    jsPlumb.deleteEndpoint(endpoints[1]);

                }
            }

        } else if($(this).attr('checked') == "checked") {


            //console.log('チェックされました------');
            // 再描画
            showHideAllConnections('show', relType);

            // modificationも再描画
            renderModifications(modanns);

        }
    });

    $('.instype_hide').live("change", function() {
        var insType = $(this).attr('title');


        if($(this).attr('checked') == undefined) {
            if(insType == "all") {

                $('.instype_hide').removeAttr('checked');

                $('.instance').hide();
            } else {
                $('.' + insType ).hide();
            }

        } else {
            if(insType == "all") {
                $('.instype_hide').attr('checked', 'checked');

                $('.instance').show();
            } else {
                $('.' + insType ).show();
            }

        }
    });


    $('.modtype_hide').live("change", function() {
        var modType = $(this).attr('title');

        if($(this).attr('checked') == undefined) {

            // allなら他のcbもはずす
            if(modType == "all") {
                $('.modtype_hide').removeAttr('checked');
            }



            // instanceに対して
            if(modType == "all") {
                $('.instance_modification').hide();
            } else {
                $('.mod_' + modType ).hide();
            }




            // relationに対して
            jsPlumb.select().each(function(conn){
                //var label = conn.getLabel();
                //console.log('label:', label);

                if(modType == "all") {
                    for(var i in modanns) {
                        var mod = modanns[i];
                        conn.hideOverlay(mod['id']);

                    }

                } else {
                    for(var i in modanns) {
                        var mod = modanns[i];
                        if(mod["type"] == modType) {
                            conn.hideOverlay(mod['id']);
                        }

                    }
                }

                /*
                if(modType == "Negation") {
                    if(label == "X") {
                        conn.setLabel("");
                    }
                } else if(modType == "Speculation") {
                    if(label == "?") {
                        conn.setLabel(null);
                    }
                }
                */
            });


        } else {

            // allなら他のcbもはずす
            if(modType == "all") {
                $('.modtype_hide').attr('checked','checked');
            }


            // instanceに対して
            if(modType == "all") {
                $('.instance_modification').show();
            } else {
                $('.mod_' + modType ).show();
            }


            // relationに対して
            jsPlumb.select().each(function(conn){
                if(modType == "all") {
                    for(var i in modanns) {
                        var mod = modanns[i];
                        conn.showOverlay(mod['id']);

                    }

                } else {
                    for(var i in modanns) {
                        var mod = modanns[i];
                        if(mod["type"] == modType) {
                            conn.showOverlay(mod['id']);
                        }

                    }
                }
            });

        }
    })

    /*
     * spanをクリック
     */
    function clickSpan(e) {
        e.preventDefault();
        //console.log('click span');
        //console.log('shiftキーが押されている:', e.shiftKey);

        // 下に重なってる要素のclickイベントを解除
        $('#doc_area span').unbind('click',arguments.callee);


        if(mode == "relation") {
            // relation mode
            var id = $(this).attr('id').split('_')[1];

            if(sourceElem == null) {
                // source element is chosen
                sourceElem = $('#' + id);
                sourceElem.addClass('source_selected');
            } else {
                // target element is chosen
                targetElem = $('#' + id);

                // 色の指定
                var color = relationTypes[relationTypeDefault]["color"];

                // rgbaに変換
                var rgba = colorTrans(color);

                // 選択されているものは、選択をはずす
                deselectConnection();

                // connection作成
                var newconn = new Object();

                newconn.id = "R" + (getMaxConnId() + 1);
                newconn.subject = sourceElem.attr('id');
                newconn.object = targetElem.attr('id');
                newconn.type = relationTypeDefault;
                newconn.created_at = (new Date()).getTime();
                addDistanceToRelation(newconn);

                relations.push(newconn);
                sortConnByDistance(relations);

                // focus control
                if(e.shiftKey) {
                    // targetを次のソースにする
                    e.preventDefault();
                    deselect();

                    if(sourceElem.hasClass('source_selected')) {
                        sourceElem.removeClass('source_selected');
                        sourceElem = null;
                        sourceElem = targetElem;
                        sourceElem.addClass('source_selected');
                    } else if(sourceElem.hasClass('ins_selected')) {
                        $('#id').removeClass('ins_selected');

                        addInstanceBorderColor($('#id'), spanTypes);
                        sourceElem = null;
                        sourceElem = targetElem;
                        sourceElem.css('border-color', '#000000').addClass('ins_selected').attr('id');
                    }

                } else if(e.ctrlKey) {
                    // sourceは元のまま
                    targetElem = null;
                } else {
                    sourceElem.removeClass('source_selected');

                    // instanceの枠の色を元に戻す
                    $('div.instance').map(function() {
                        if($(this).hasClass('ins_selected')){
                            $(this).removeClass('ins_selected');
                            addInstanceBorderColor($(this), spanTypes);
                        }
                    });

                    sourceElem = null;
                    targetElem = null;
                }


                // 書きなおし
                jsPlumb.reset();

                for (var j in relations) {
                    var rel = relations[j];
                    var id = rel['id'];
                    var color = relationTypes[rel['type']]["color"];
                    var rgba = colorTrans(color);

                    if (id == newconn.id) {
                        var rgbas = rgba.split(',');
                        rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',1)';
                        var c = makeConnection(rel['subject'], rel['object'], rel['type'], rgba, id, "selected", modanns);
                        selectedConns.push(c);
                    } else {
                        makeConnection(rel['subject'], rel['object'], rel['type'], rgba, id, "unselected", modanns);
                    }
                }

                saveCurrent("relanns");
            }

        } else if(mode == "edit") {
            // span編集モード

            if(isCtrl) {

                // ctrl我押されているので、選択要素を追加
                var isExit = false;

                for(i in selectedIds) {
                    if(selectedIds == $(this).attr('id')) {
                        isExit = true;
                        break;
                    }
                }

                if(!isExit) {
                    selectedIds.push($(this).attr('id'));

                    if($('span#' + $(this).attr('id')).hasClass('partial')) {
                        //console.log('不完全要素');
                        $('span#' + $(this).attr('id')).addClass('partialSelected');
                    } else {
                        $('span#' + $(this).attr('id')).addClass('selected');
                    }

                    // 該当するテーブルを選択状態にする
                    //$('#t_' + $(this).attr('id')).removeAttr('style');
                    // $('#t_' + $(this).attr('id')).addClass('t_selected');

                    if($('#t_' + $(this).attr('id')).hasClass('t_partial')){
                        $('#t_' + $(this).attr('id')).addClass('t_partialSelected');
                    } else {
                        $('#t_' + $(this).attr('id')).addClass('t_selected');
                    }

                    // remove_btnを表示
                    $('.annotation.t_selected .removeBtn').show();
                    $('.t_partialSelected .removeBtn').show();

                }
            } else if(isShift && selectedIds.length == 1) {
                //console.log('shiftが押されています');
                // shiftが押されている
                var firstId = selectedIds.pop();
                var secondId = $(this).attr('id');

                // 一旦、元に戻す
                $('#doc_area span').removeClass('selected').removeClass('partialSelected');
                $('table.annotation').removeClass('t_selected').removeClass('t_partialSelected');
                $('.removeBtn').hide();

                // selectedを削除して、class指定が空になった要素はclass="noCategoy"にする
                //$('#doc_area span[class=""]').addClass('noCategory');
                // 一旦空にする
                selectedIds.splice(0, selectedIds.length);

                sortSpans(spans);

                // firtsIdとsecondIdのdoc_area内での順番をもとめる
                var firstIndex;
                var secondIndex
                $('#doc_area span').map(function(i){
                    if($(this).attr('id') == firstId) {
                        firstIndex = i;
                    }
                    if($(this).attr('id') == secondId) {
                        secondIndex = i;
                    }
                });

                if(secondIndex < firstIndex) {
                    var tmpIndex;
                    tmpIndex = firstIndex;
                    firstIndex = secondIndex;
                    secondIndex = firstIndex;
                }

                $('#doc_area span').map(function(i){
                    if(i >= firstIndex && i <= secondIndex) {
                        $(this).addClass('selected');
                        selectedIds.push($(this).attr('id'));
                    }
                });

                for(var i in selectedIds) {
                    var id = selectedIds[i];
                    $('#t_' + id).addClass('t_selected');
                }
                $('.annotation.t_selected .removeBtn').show();

                deselect();

            } else {

                // ctrl, shiftが押されていない場合
                $('#doc_area span').removeClass('selected').removeClass('partialSelected');
                $('table.annotation').removeClass('t_selected').removeClass('t_partialSelected');
                $('.removeBtn').hide();

                // selectedを削除して、class指定が空になった要素はclass="noCategoy"にする
                //$('#doc_area span[class=""]').addClass('noCategory');
                // 一旦空にする
                selectedIds.splice(0, selectedIds.length);

                var selectedId = $(this).attr('id');

                selectedIds.push(selectedId);

                if($('span#' + $(this).attr('id')).hasClass('partial')) {
                    //console.log('不完全要素');
                    $('span#' + $(this).attr('id')).addClass('partialSelected');
                } else {
                    $('span#' + $(this).attr('id')).addClass('selected');
                }

                // 該当するテーブルを選択状態にする
                if($('#t_' + $(this).attr('id')).hasClass('t_partial')){
                    $('#t_' + $(this).attr('id')).addClass('t_partialSelected');
                } else {
                    $('#t_' + $(this).attr('id')).addClass('t_selected');
                }

                // remove_btnを表示
                $('.annotation.t_selected .removeBtn').show();
                $('.t_partialSelected .removeBtn').show();

                // 選択された用素のdoc_area内での順番
                sortSpans(spans);
                for(var i = 0; i <spans.length; i++) {
                    if(spans[i]['id'] == selectedId) {
                        selectedIdOrder = i;
                    }
                }
            }
            //setCurrentStorage(spans);
        }
        return false;
    }


    function deselectConnection() {
        //console.log('選択されているconnは:', selectedConns.length);

        for(var i in selectedConns) {
            var conn = selectedConns[i];

            var subject = conn.sourceId;
            var object = conn.targetId;
            var rgba = conn.paintStyleInUse["strokeStyle"];
            var type = conn.getParameter("type");
            var connId = conn.getParameter("connId");
            var endpoints = conn.endpoints;

            jsPlumb.deleteEndpoint(endpoints[0]);
            jsPlumb.deleteEndpoint(endpoints[1]);

            makeConnection(subject, object, relationTypeDefault, rgba, connId, "unselected", modanns);

        }

        selectedConns.splice(0, selectedConns.length);

    }



    /*
     * 右クリックで合体
     */
    $('#doc_area span').live('contextmenu', function(e){
        //console.log('右クリック');

        if(mode == "relation") {
           // relationモード

        } else if(mode == "edit") {

            if(selectedIds.length == 1) {
                var secondSelected = $(this);

                var selectedId = selectedIds.shift();
                //var firstParentId = selected.parent().attr('id');

                var firstParentId = $('span#' + selectedId).parent().attr('id');
                var secondParentId = secondSelected.parent().attr('id');

                if(firstParentId == secondParentId && selectedId != secondSelected.attr('id')) {
                    //console.log('合体');

                    // 選択されたspanのidを保存
                    var firstJson = findJson(selectedId);                   // 最初に選択された要素
                    var secondJson = findJson(secondSelected.attr('id'));   // 右クリックで選択された要素

                    var i;
                    var len = spans.length - 1 ;

                    if(firstJson['span']['end'] < secondJson['span']['end']) {
                        //console.log('最初の要素が前にある場合');
                        // 最初の要素が前にある場合
                        firstJson['span']['end'] = secondJson['span']['end'];


                        for(i = len; i >= 0 ;i--){
                            // 2番目に選択された要素を削除
                            if(spans[i]['id'] == secondSelected.attr('id')) {

                                // このspan要素に関するinsatnceのobjectを1番目の要素に変更する
                                for(var j in insanns) {
                                    var ins = insanns[j];
                                    if(ins["object"] == spans[i]['id']) {
                                        ins["object"] = firstJson["id"];
                                    }
                                }

                                // このspan要素に関するrelationのobjectまたはsubjectを1番目の要素に変更する
                                for(var j in relations) {
                                    var conn = relations[j];
                                    if(conn["subject"] == spans[i]['id']) {
                                        conn["subject"] = firstJson["id"];
                                    }
                                    if(conn["object"] == spans[i]['id']) {
                                        conn["object"] = firstJson["id"];
                                    }
                                }


                                spans.splice(i, 1);
                                break;
                            }
                        }

                    } else {
                        //console.log('最初の要素が後ろにある場合');
                        // 最初の要素が後ろにある場合
                        //secondJson['end'] = firstJson['end'];

                        firstJson['span']['begin'] = secondJson['span']['begin'];

                        for(i = len; i >= 0 ;i--){
                            // 2番目の要素を削除
                            if(spans[i]['id'] == secondSelected.attr('id')) {


                                // このspan要素に関するinsatnceのobjectを1番目の要素に変更する
                                for(var j in insanns) {
                                    var ins = insanns[j];
                                    if(ins["object"] == spans[i]['id']) {
                                        ins["object"] = firstJson["id"];
                                    }
                                }

                                // このspan要素に関するrelationのobjectまたはsubjectを1番目の要素に変更する
                                for(var j in relations) {
                                    var conn = relations[j];
                                    if(conn["subject"] == spans[i]['id']) {
                                        conn["subject"] = firstJson["id"];
                                    }
                                    if(conn["object"] == spans[i]['id']) {
                                        conn["object"] = firstJson["id"];
                                    }
                                }


                                spans.splice(i, 1);
                                break;
                            }
                        }
                    }

                    renderSpans(spans);
                    addCategoryColor(spanTypes);

                    selectedIds.push(selectedId);

                    $('span#' + selectedId).addClass('selected');

                    $('#t_' + selectedId).addClass('t_selected');
                    // remove_btnを表示
                    $('.annotation.t_selected .removeBtn').show();


                    renderInstances(insanns);
                    addInstypeColor(instanceTypes);

                    reMakeConnectionOnDelete();

                    saveCurrent("catanns_insanns_relanns")

                } else {
                    //console.log('合体できません');
                }
            }
        }
        return false;
    });

    /*
     * 削除ボタンクリック
     */
    $('.removeBtn').live('click', function(event) {

        // 下に重なっている要素にイベントを伝搬しない
        event.stopPropagation();

        var i;
        var k;
        var len = relations.length - 1;

        var selectedId;

        if(mode == "relation") {
            // connectionまたはmodificationの削除
            selectedId = $(this).parent().parent().parent().parent().attr('id').split('_')[2];

            //var isDeleteRel = false; // relationが削除されるか
           // var isDeleteMod = false; // relationの削除で関連するmodificationが削除されるか

            //console.log('selectedId', selectedId);

            for(i = 0; i < selectedConns.length;i++) {

                var endpoints = selectedConns[i].endpoints;
                var id = selectedConns[i].getParameter("connId");

                if(id == selectedId) {
                    jsPlumb.deleteEndpoint(endpoints[0]);
                    jsPlumb.deleteEndpoint(endpoints[1]);
                    selectedConns.splice(i, 1);
                    //isDeleteRel = true;
                }


                for(k =  len; k >= 0; k--) {
                    if(relations[k]["id"] == selectedId) {
                        //console.log('削除するconnection id:', id);
                        relations.splice(k, 1);
                        //isDeleteMod = true;
                    }
                }
            }

            // 選択されているmodificationは
            len = modanns.length - 1;
            for(var k = len; k >= 0; k--) {
                if(modanns[k]['id'] == selectedId) {
                    //console.log('spliceします');
                    modanns.splice(k, 1);
                    //isDeleteMod = true;
                }
            }


            var conns = getConnectionData();

            for(var j in conns) {
                var conn = conns[j];

                var labelText = "";
                var modId = "";
                for(var i = 0; i < conn.overlays.length; i++) {
                    var overlay = conn.overlays[i];
                    //console.log('label:', overlay["type"]);

                    if(overlay["type"] == "Label") {
                        //console.log(overlay.getLabel());
                        labelText = overlay.getLabel();
                        modId = overlay["id"];

                        if(selectedId == modId) {

                            var connId = conn["id"];
                            var subject = conn["subject"];
                            var object = conn["object"]
                            var rgba = conn["paintStyle"];
                            var endpoints = conn["endpoints"];
                            var type = conn['type'];

                            jsPlumb.deleteEndpoint(endpoints[0]);
                            jsPlumb.deleteEndpoint(endpoints[1]);

                            var c = makeConnection(subject, object, type, rgba, connId, "unselected", modanns);
                        }
                    }
                }
            }

            len = selectedModificationIds.length - 1;
            for(k = len; k >= 0; k--) {
                if(selectedInstanceIds[k] == selectedId) {
                    selectedModificationIds.splice(k, 1);
                }
            }

            renderModifications(modanns);
            addModtypeColor(modTypes);

            saveCurrent("relanns_modanns");

        } else if(mode =="edit") {
            // removeBtnをクリックされたid

            // spanが削除された時に、削除されるインスタンスのidの配列
            var deleteInsIds = new Array();

            // spanが削除された時に、削除されるrelationのIDの配列
            var deleteRelIds = new Array();

            //var isDeleteIns = false; // インスタンスも削除されるか
            //var isDeleteRel = false; // relationも削除されるか
            //var isDeleteMod = false; // modificationも削除されるか


            if($(this).parent().parent().parent().parent().hasClass('annotation')) {
                //console.log('annotation table');
                selectedId = $(this).parent().parent().parent().parent().attr('id').split('_')[1];

                //console.log('削除されるspan:', selectedId);

                for(var i in spans) {
                    if(spans[i]['id'] == selectedId) {
                        // この場合、このインスタンスも削除される

                        for(var j in insanns) {
                            //console.log('instance object:', insanns[j]["object"]);
                            if(insanns[j]["object"] == selectedId ) {
                                //console.log('instanceも削除', insanns[j]["id"]);
                                deleteInsIds.push(insanns[j]["id"]);
                                //isDeleteIns = true; // instanceも削除される
                            }
                        }
                        spans.splice(i, 1);
                    }

                    len = relations.length - 1;
                    for(k = len; k >= 0; k--) {
                        var conn = relations[k];
                        if(conn.subject == selectedId || conn.object == selectedId) {
                            //console.log('spanで削除するrelationがあります');
                            //isDeleteRel = true; // relationも削除される
                            deleteRelIds.push(conn["id"]);
                            relations.splice(k, 1);
                        }
                    }

                }

                for(var k in deleteInsIds) {
                    var insId = deleteInsIds[k];

                    var len = insanns.length - 1;
                    var i;
                    for(i = len; i >= 0; i--){
                        if(insanns[i]['id'] == insId) {
                            insanns.splice(i, 1);
                        }
                    }


                    len = relations.length - 1;
                    for(i = len;  i >= 0; i--) {
                        var conn = relations[i];
                        if(conn.subject == insId || conn.object == insId) {
                            //console.log("instance id:", conn["id"]);
                            deleteRelIds.push(conn["id"]);
                            //isDeleteRel = true; // instanceに紐ずいたrelationも削除される
                            relations.splice(i, 1);
                        }
                    }

                    // 削除されるinstance上のmodification
                    len = modanns.length - 1;
                    for(i = len ; i >= 0; i--) {
                        var mod = modanns[i];
                        if(mod["object"] == relId) {
                            //isDeleteMod = true;
                            modanns.splice(i, 1);
                        }
                    }

                }

                // 削除されるrelation上のmodification
                for(var k in deleteRelIds) {
                    var relId = deleteInsIds[k];

                    len = modanns.length - 1;
                    for(i = len; i >= 0; i--) {
                        var mod = modanns[i];
                        if(mod["object"] == relId) {
                            //isDeleteMod = true;
                            modanns.splice(i, 1);
                        }
                    }
                }

                // 空にする
                selectedIds.splice(0, selectedIds.length);

                renderSpans(spans);
                addCategoryColor(spanTypes);
                //setCurrentStorage(spans);

                renderInstances(insanns);
                addInstypeColor(instanceTypes);
                //setCurrentInsannsStorage(insanns);

                reMakeConnectionOnDelete();

                //setCurrentConnStorage(relations);

                renderModifications(modanns);
                addModtypeColor(modTypes);

                saveCurrent("catanns_insanns_relanns_modanns");

            } else if($(this).parent().parent().parent().parent().hasClass('instance')) {
                //console.log('instance table');
                selectedId = $(this).parent().parent().parent().parent().attr('id').split('_')[2];

                // この場合はinsatnceが削除される


                for(var i in insanns) {
                    var ins = insanns[i];

                    if(ins['id'] == selectedId) {

                        var k;
                        var len = relations.length - 1;
                        for(k = len; k >= 0; k--) {
                            var conn = relations[k];
                            if(conn["subject"] == ins["id"] || conn["object"] == ins["id"] ) {
                                //紐づいたrelationも削除される
                                deleteRelIds.push(conn["id"]);
                                relations.splice(k, 1);
                                //isDeleteRel = true; // instanceも削除される
                            }
                        }

                        len = modanns.length;
                        for(k = len; k >= 0; k--) {
                            var mod = modanns[k];
                            if(mod["object"] == ins['id']) {
                                // insatnce上のmodificationも削除される
                                modanns.splice(k, 1);
                               // isDeleteMod = true;
                            }
                        }

                        insanns.splice(i, 1);
                    }
                }

                for(var i in deleteRelIds) {
                    len = modanns.length - 1;
                    for(k = len ; k >= 0; k--) {
                        var mod = modanns[k];
                        if(mod["object"] == deleteRelIds[i]) {
                            // modificationも削除される
                            modanns.splice(k, 1);
                            //isDeleteMod = true;
                        }
                    }

                }

                // 空にする
                selectedInstanceIds.splice(0, selectedInstanceIds.length);

                renderSpans(spans);
                addCategoryColor(spanTypes);
                //setCurrentStorage(spans);

                renderInstances(insanns);
                addInstypeColor(instanceTypes);
                //setCurrentInsannsStorage(insanns);

                reMakeConnectionOnDelete();

                //setCurrentConnStorage(relations);

                renderModifications(modanns);
                addModtypeColor(modTypes);

                saveCurrent("insanns_relanns_modanns");

            }

            deleteInsIds = null;
            deleteRelIds = null;

        }
    });

    /*
     * 選択を解除
     */
    function cancelSelect(event) {
        // ctrlまたはshiftが押されていないければ
        //console.log(event.target);
        //console.log('createCount:', createCount);
        // console.log('cancel Select');

        if(!isCtrl || !isShift) {

            if(mode == "relation") {

                //console.log('cancel Select in relation');
                // relationモード
                sourceElem = null;
                targetElem = null;

                $('#doc_area span').removeClass('source_selected');
                $('table.annotation').removeClass('t_selected');
                $('table.annotation .removeBtn').hide();

                // instanceの枠の色を元に戻す
                $('div.instance').map(function() {
                    if($(this).hasClass('ins_selected')){
                        $(this).removeClass('ins_selected');

                        addInstanceBorderColor($(this), spanTypes);

                    }
                });

                // instanceテーブルの選択を外す
                $('table.instance').removeClass('t_selected');
                $('table.instance .removeBtn').hide();

                $('table.relation').removeClass('t_selected');
                $('table.relation .removeBtn').hide();

                // modificationの非選択
                if(selectedModificationIds.length > 0) {
                    selectedModificationIds.splice(0, selectedModificationIds.length);
                    unselectModification();
                    addModtypeColor(modTypes);
                }

                // 空にする
                selectedConns.splice(0, selectedConns.length);
                reMakeConnection();

                addModtypeColor(modTypes);

            } else if(mode == "edit") {
                // span編集モード

                //console.log("span編集モード選択解除:", $(this));
                //console.log('selectedModificationIds.length:', selectedModificationIds.length);


                $('table.relation').removeClass('t_selected');
                $('table.relation .removeBtn').hide();

                //selectedModificationIds.splice(0, selectedModificationIds.length);
                if(selectedModificationIds.length > 0) {
                    unselectModification();
                    addModtypeColor(modTypes);
                }

                // 空にする
                selectedIds.splice(0, selectedIds.length);
                selectedInstanceIds.splice(0, selectedInstanceIds.length);

                $('#doc_area span').removeClass('selected').removeClass('partialSelected');
                $('table.annotation').removeClass('t_selected').removeClass('t_partialSelected');
                $('table.annotation .removeBtn').hide();

                // instanceの枠の色を元に戻す
                $('div.instance').map(function() {
                    if($(this).hasClass('ins_selected')){
                        $(this).removeClass('ins_selected');

                        addInstanceBorderColor($(this), spanTypes);

                    }
                });

                // instanceテーブルの選択を外す
                $('table.instance').removeClass('t_selected');
                $('table.instance .removeBtn').hide();

            }

            event.stopPropagation();
        }
    }

    /*
     *relationのsourceElem及びtargetElemの選択を解除する
     */
    function cancelSelectSourceAndTargetElement() {
        //console.log('cancelSelectSourceAndTargetElement');
        if(mode == "relation") {
            if(sourceElem != null) {
                sourceElem.removeClass('source_selected');
                sourceElem = null;
            }

            if(targetElem != null) {
                targetElem = null;
            }

            // instanceの枠の色を元に戻す
            $('div.instance').map(function() {
                if($(this).hasClass('ins_selected')){
                    $(this).removeClass('ins_selected');
                    addInstanceBorderColor($(this), spanTypes);
                }
            });

        }
    }


    /*
     * マウスドラッグ時の開始位置の調整
     */
    function validateStartDelimiter(startPosition) {
        // original document
        var str = $('#src_area').text();

        // 開始文字
        var startChar = str.charAt(startPosition);

        // 開始位置
        var pos = startPosition;

        // はじめにstart位置の文字ががboundaryCharであれば、
        // boundaryCharがなくなる位置まで後ろにずらす
        while(searchBoundaryChar(startChar) >= 0){
            //console.log('boundaryがあります');
            pos = pos + 1;
            startChar = str.charAt(pos);
        }

        //console.log('boundary修正startPosition', pos, ":", str.charAt(pos));
        // つぎに、delimitCharacterが現れるまでstart位置を前に戻す
        startChar = str.charAt(pos);
        //console.log("startChar:", startChar, ":", str.charCodeAt(pos) );

        // 次に、その位置がdelimitであれば、そのまま
        // delimjitでなければ、delimitCharcterが現れるまでstart位置を前にさかのぼる
        if(searchDelimitChar(startChar) >= 0) {
            return pos;
        } else {
            while(searchDelimitChar(startChar) < 0) {
                pos = pos - 1;
                startChar = str.charAt(pos);
                //console.log(pos, ":", startChar)
            }
            return pos + 1;
        }
    }

    /*
     * マウスドラッグ時の開始位置の調整2
     * ドラッグした位置以上に縮める
     */
    function validateStartDelimiter2(startPosition) {
        // original document
        var str = $('#src_area').text();

        // 開始位置はドラッグした最後の文字
        startPosition = startPosition -1;

        // 開始文字
        var startChar = str.charAt(startPosition);

        // 開始位置
        var pos = startPosition;

        //console.log('startChar:', startChar);

        // はじめにstart位置の文字ががboundaryCharであれば、
        // boundaryCharがなくなる位置まで後ろにずらす
        if(searchBoundaryChar(startChar) < 0) {
            //console.log('boundaryではありません');
            if(searchDelimitChar(startChar) >= 0) {
               // console.log('delimiterです');
                pos = pos + 1;
             } else {
                //console.log('delimiterではありません');
                while(searchDelimitChar(startChar) < 0) {
                    pos = pos + 1;
                    startChar = str.charAt(pos);
                    //console.log(pos, ":", startChar)
                }
               // console.log('pos:', pos);

            }
        }

        while(searchBoundaryChar(startChar) >= 0) {
            //console.log('boundaryがあります');
            pos = pos + 1;
            startChar = str.charAt(pos);
            //console.log(pos, ":", startChar);
        }
        return pos;

    }


    /*
     * マウスドラッグ時の終了位置の調整
     */
    function validateEndDelimiter(endPosition) {
        // original document
        var str = $('#src_area').text();

        var endChar = str.charAt(endPosition - 1);

        var pos = endPosition - 1;

        // はじめにend位置の文字ががboundaryCharであれば、
        // boundaryCharがなくなる位置まで前にずらす
        while(searchBoundaryChar(endChar) >= 0){
            //console.log('boundaryがあります');
            pos = pos - 1;
            endChar = str.charAt(pos);
            //console.log(pos, ":", endChar);
        }
        //console.log('boundary修正endPosition', pos, ":", str.charAt(pos));
        // つぎに、delimitCharacterが現れるまでend位置を後ろにずらす
        endChar = str.charAt(pos);

        // 次に、その位置がdelimitであれば、そのまま
        // delimjitでなければ、delimitCharcterが現れるまでend位置を後ろにずらす
        if(searchDelimitChar(endChar) >= 0) {
            //console.log('delimiterです');
            return pos + 1;
        } else {
            //console.log('delimiterではありません');
            while(searchDelimitChar(endChar) < 0) {
                pos = pos + 1;
                endChar = str.charAt(pos);
                //console.log(pos, ":", endChar)
            }
            return pos;
        }
    }

    /*
     * マウスドラッグ時の終了位置の調整
     * ドラッグした位置以上に縮める
     */
    function validateEndDelimiter2(endPosition) {
        // original document
        var str = $('#src_area').text();

        var endChar = str.charAt(endPosition);

        var pos = endPosition;

        // はじめにend位置の文字ががboundaryCharであれば、
        // boundaryCharがなくなる位置まで前ににずらす
        if(searchBoundaryChar(endChar) < 0) {
            //console.log('boundaryではありません');

            if(searchDelimitChar(endChar) >= 0) {
                //console.log('delimiterです');
                pos = pos - 1;
            } else {
                //console.log('delimiterではありません');

                while(searchDelimitChar(endChar) < 0) {
                    pos = pos - 1;
                    endChar = str.charAt(pos);
                    //console.log(pos, ":", endChar)
                }

                //console.log('pos:', pos);

            }
        }

        while(searchBoundaryChar(endChar) >= 0) {
            //console.log('boundaryがあります');
            pos = pos - 1;
            endChar = str.charAt(pos);
            //console.log(pos, ":", endChar);
        }

        return pos + 1;


    }

    /*
     * text部分をドラッグし、選択した状態
     */

    //Todo

    // span編集モードでは
    // conn.unbind('click');
    // が必要のようだ
    function unbindConnectionEvent() {

        // connectionListを取得
        var connectionList = jsPlumb.getConnections();

        if(connectionList != undefined){

            //console.log('connectionList数:', connectionList.length);

            for(i in connectionList) {
                var conn = connectionList[i];
                conn.unbind("click");
            }
        }

    }

    function bindConnectionEvent() {
        // connectionListを取得
        var connectionList = jsPlumb.getConnections();

        if(connectionList != undefined){

            var conn = connectionList[i];
            // 選択
            conn.bind("click", function(conn, e) {
                //console.log('リレーションモード:', isRelationMode);

                if(mode == "relation") {

                    // 一旦削除して、新たに太い線をかく
                    e.stopPropagation();

                    if(isCtrl) {
                        var source = conn.source;
                        var target = conn.target;
                        var rgba = conn.paintStyleInUse["strokeStyle"];
                        var endpoints = conn.endpoints;
                        var connId = conn.getParameter('connId');
                        var type = conn.getParameter('type');

                        //console.log('選択されたコネクションID:', connId);

                        var subject = source.attr('id');
                        var object = target.attr('id');

                        var c = makeConnection(subject, object, type, rgba, connId, "selected", modanns);

                        selectedConns.push(c);

                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);

                        // テーブルを選択状態にする
                        $('#relation_t_' + connId).addClass('t_selected');
                        // remove_btnを表示
                        $('.relation.t_selected .removeBtn').show();
                        //console.log('削除ボタン:', $('.relation.t_selected .removeBtn'));

                    } else {
                        //console.log('選択されました');
                        // 一旦、選択されていたconnectionを再描画する
                        //console.log('選択されているconnection数:',selectedConns.length);

                        for(i in selectedConns) {
                            var sConn = selectedConns[i];
                            var source = sConn.source;
                            var target = sConn.target;
                            var rgba = sConn.paintStyleInUse["strokeStyle"];
                            var endpoints = sConn.endpoints;
                            var connId = sConn.getParameter('connId');
                            var type = sConn.getParameter('type');

                            //console.log('選択を解除します');
                            //console.log('endpoints:',endpoints);

                            var subject = source.attr('id');
                            var object = target.attr('id');

                            var c = makeConnection(subject, object, type, rgba, connId, "unselected", modanns);

                            jsPlumb.deleteEndpoint(endpoints[0]);
                            jsPlumb.deleteEndpoint(endpoints[1]);

                        }

                        // 空にする
                        selectedConns.splice(0, selectedConns.length);

                        var source = conn.source;
                        var target = conn.target;
                        var rgba = conn.paintStyleInUse["strokeStyle"];
                        var endpoints = conn.endpoints;
                        var connId = conn.getParameter('connId');
                        var type = conn.getParameter('type');

                        /*
                        var labelText = "";
                        var modId = "";
                        for(var i = 0; i < conn.overlays.length; i++) {
                            var overlay = conn.overlays[i];
                            console.log('label:', overlay["type"]);

                            if(overlay["type"] == "Label") {
                                console.log(overlay.getLabel());
                                labelText = overlay.getLabel();
                                modId = overlay["id"];
                            }
                        }
                        */

                        var subject = source.attr('id');
                        var object = target.attr('id');

                        //var c = makeConnection(source, target, type, rgba, connId, "selected");
                        //var c = makeConnection(subject, object, type, rgba, connId, "selected", labelText, modId, "");

                        var c = makeConnection(subject, object, type, rgba, connId, "selected", modanns);
                        //console.log(c);

                        selectedConns.push(c);

                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);

                        // テーブルを選択状態にする
                        $('.relation').removeClass('t_selected');
                        $('.relation .removeBtn').hide();

                        $('#relation_t_' + connId).addClass('t_selected');
                        // remove_btnを表示

                        $('.relation.t_selected .removeBtn').show();

                    }
                }
                return false;
            });
        }

    }


    function doMouseup(e) {
        var selectionRange = window.getSelection();
        var sr = selectionRange.getRangeAt(0);


        if(sr.startContainer != $('div#doc_area').get(0)) {
            // ブラウザのでデフォルトの挙動で
            // ダブルクリックで、テキストが選択されるが、
            // 連続で行うと、その親のdoc_arreaが選択されるので、
            // それ以外の時に、以下を行う

            //e.preventDefault();


            //console.log('doMouseup');
            if(isShift) {
                return false;
            }

            if(spans != undefined) {

                // 位置取得
                var selection = window.getSelection();

                // 文字列が選択されていると、isCollapsed == false
                if(!selection.isCollapsed) {

                    var range = selection.getRangeAt(0);
                    var anchorRange = document.createRange();
                    anchorRange.selectNode(selection.anchorNode);
                    // console.log('anchorRange:', anchorRange);
                    // console.log('selection.compareBoundaryPoints', range.compareBoundaryPoints(Range.START_TO_START, anchorRange));//二つのRangeの始点同士の位置を比較
                    //console.log('selection.compareBoundaryPoints', range.compareBoundaryPoints(Range.START_TO_END, anchorRange));//selectionRangeの始点と、rangeの終点を比較
                    //console.log('selection.compareBoundaryPoints', range.compareBoundaryPoints(Range.END_TO_START, anchorRange));//selectionRangeの終点と、rangeの始点を比較
                    // console.log('selection.compareBoundaryPoints', range.compareBoundaryPoints(Range.END_TO_END, anchorRange));//二つのRangeの終点同士の位置を比較

                    // 選択されたテキストが属するノード
                    // 選択されたテキストより前にHTMLタグがある場合は、それ以降になる。
                    var nodeTxt = selection.anchorNode.textContent;

                    var parentNode = selection.anchorNode.parentNode;
                    //console.log('親ノード:', parentNode);

                    var r = document.createRange();

                    var range = selection.getRangeAt(0);

                    //console.log('selection.anchorNode.parentElement.id:', selection.anchorNode.parentElement.id);
                    //console.log('selection.focusNode.parentElement.id:', selection.focusNode.parentElement.id);

                    // anchorNodeの親ノードとfocusNodeの親ノードが同じidなら
                    // 新たにマークするか、あるいはマーク内にさらにマークである
                    if( selection.anchorNode.parentElement.id === selection.focusNode.parentElement.id) {


                        if(!isCtrlAlt) {
                            // 新規マーク作成
                            //console.log('新規マーク');
                            createElement(spans, selection);
                        } else {

                            //if(selected != null) {
                            if(selectedIds.length == 1) {
                                // 選択があり、さらにCtrl + Alt キーが押された状態で、anchorNodeまたはfocusNodeがselect上にある場合は
                                // 切り離すまたは削除

                                var selectedId = selectedIds.pop();
                                if(selectedId == selection.anchorNode.parentElement.id || selectedId == selection.focusNode.parentElement.id) {
                                    // anchorNodeまたはfocusNodeが選択された要素上にあるので
                                    //console.log('切り離し');
                                    separateElement(spans, selection, selectedId);
                                    //selected = null;
                                } else {
                                    // selectionに選択要素のNodeが完全に入っているか
                                    if(selection.containsNode($('span#' + selectedId).get(0).childNodes[0], true)) {
                                        // ドラッグした領域が選択された要素の範囲を越えているので削除
                                        //console.log('削除');
                                        removeElement(spans, selection, selectedId);
                                        //selected = null;
                                    }
                                }
                            }
                        }
                    } else {

                        var anchorChilds = selection.anchorNode.parentNode.childNodes;
                        // focusノードを起点にしたchild node
                        var focusChilds = selection.focusNode.parentNode.childNodes;

                        var absoluteAnchorPosition = getAbsoluteAnchorPosition(anchorChilds, selection);
                        var absoluteFocusPosition = getAbsoluteFocusPosition(focusChilds, selection);

                        //console.log('絶対anchorPosition:', absoluteAnchorPosition);
                        //console.log('絶対focusPosition', absoluteFocusPosition);

                        if(!isCtrlAlt) {

                            // この場合は、選択範囲の始点と終点が同じノード上似ないので
                            // 新規作成する場合と、伸ばす縮める場合がある
                            //console.log('新規作成または伸ばす、縮める');


                            // 選択範囲の終点がマークの終了位置と同じ
                            if(findJson(selection.focusNode.parentNode.id) != undefined && findJson(selection.focusNode.parentNode.id)['span']["end"] == absoluteFocusPosition) {
                                // 新規作成
                                //console.log("新規作成する場合もある1");

                                // focusNodeのマークの親マークの終了位置がfocusNodeのマークの終了位置より大きいものがある場合は
                                // マークがまたがるので、新規作成しない
                                function IsNodeAcross(selection) {
                                    var element = selection.focusNode.parentElement;

                                    var focusEndPosition = findJson(selection.focusNode.parentElement.id)['span']['end'];

                                    while(true) {
                                        if(element.id == "doc_area") {
                                            return true;
                                        }

                                        //console.log('node id:', element.id);

                                        if(findJson(element.id)['span']["end"] > focusEndPosition ) {
                                            return false;
                                        }

                                        element = element.parentElement;
                                    }
                                }
                                //console.log('新規?:', IsNodeAcross(selection));
                                if(IsNodeAcross(selection)) {
                                    createElement(annoJson,selection);
                                }

                            } else if(findJson(selection.focusNode.parentNode.id) != undefined && findJson(selection.focusNode.parentNode.id)['span']["begin"] == absoluteFocusPosition) {
                                // 選択範囲の終点がマークの開始位置と同じ
                                // 新規作成
                                //console.log("新規作成する場合もある2");

                                // focusNodeのマークの親マークの開始位置がfocusNodeのマークの開始位置より小さいものがある場合は
                                // マークがまたがるので、新規作成しない
                                function IsNodeAcross(selection) {
                                    var element = selection.focusNode.parentElement;

                                    var focusBeginPosition = findJson(selection.focusNode.parentElement.id)['span']['begin'];

                                    while(true) {
                                        if(element.id == "doc_area") {
                                            return true;
                                        }

                                        //console.log('node id:', element.id);

                                        if(findJson(element.id)['span']["begin"] < focusBeginPosition ) {
                                            return false;
                                        }

                                        element = element.parentElement;
                                    }
                                }
                                //console.log('新規?:', IsNodeAcross(selection));
                                if(IsNodeAcross(selection)) {
                                    createElement(spans,selection);
                                }
                            }

                            if(findJson(selection.anchorNode.parentNode.id) != undefined && findJson(selection.anchorNode.parentNode.id)['span']["end"] == absoluteAnchorPosition) {
                                // 選択範囲の開始位置がマークの終了位置と同じ
                                // 新規作成
                                //console.log("新規作成する場合もある3");

                                // anchorNodeのマークの親マークの終了位置がanchorNodeのマークの終了位置より大きいものがある場合は
                                // マークがまたがるので、新規作成しない
                                function IsNodeAcross(selection) {
                                    var element = selection.anchorNode.parentElement;
                                    //var anchorEndPosition = annoJson[selection.anchorNode.parentElement.id]['end'];

                                    // focusノードを起点にしたchild node
                                    var focusChilds = selection.focusNode.parentElement.childNodes;

                                    // そのspanの文字数を計算
                                    var len = getFocusPosBySpan(focusChilds, selection);

                                    //console.log('selection.focusOffset:', selection.focusOffset);
                                    var absoluteBeginPosition = len + selection.focusOffset;

                                    //console.log('選択終了位置の絶対位置:', absoluteBeginPosition);

                                    while(true) {
                                        if(element.id == "doc_area") {
                                            return true;
                                        }

                                        //console.log('node id:', element.id);

                                        if(findJson(element.id)['span']["begin"] > absoluteBeginPosition && findJson(element.id)['span']['begin'] < findJson(selection.anchorNode.parentNode.id)['span']['begin']) {
                                            return false;
                                        }

                                        element = element.parentElement;
                                    }
                                }
                                //console.log('新規?:', IsNodeAcross(selection));
                                if(IsNodeAcross(selection)) {
                                    createElement(spans, selection);
                                }

                            } else if(findJson(selection.anchorNode.parentNode.id) != undefined && findJson(selection.anchorNode.parentNode.id)['span']["begin"] == absoluteAnchorPosition) {
                                // 新規作成
                                //console.log("新規作成する場合もある4");

                                // anchorNodeのマークの終了位置と選択範囲の終了位置の間にあるマークの終了位置がある場合は
                                // マークがまたがるので、新規作成しない
                                function IsNodeAcross(selection) {
                                    var element = selection.anchorNode.parentElement;

                                    // focusノードを起点にしたchild node
                                    var focusChilds = selection.focusNode.parentElement.childNodes;

                                    // そのspanの文字数を計算
                                    var len = getFocusPosBySpan(focusChilds, selection);

                                    //console.log('selection.focusOffset:', selection.focusOffset);

                                    var absoluteEndPosition = len + selection.focusOffset;

                                    while(true) {
                                        if(element.id == "doc_area") {
                                            return true;
                                        }

                                        //console.log('node id:', element.id);

                                        if(findJson(element.id)['span']['end'] > findJson(selection.anchorNode.parentElement.id)['span']['end'] && findJson(element.id)['span']["end"] < absoluteEndPosition ) {
                                            return false;
                                        }

                                        element = element.parentElement;
                                    }
                                }
                                //console.log('新規?:', IsNodeAcross(selection));
                                if(IsNodeAcross(selection)) {
                                    createElement(spans,selection);
                                }

                            }


                            if(selectedIds.length == 1) {
                                var selectedId = selectedIds.pop();
                                if(selectedId == selection.focusNode.parentElement.id) {

                                    // 縮める、伸ばす
                                    //console.log('縮める');
                                    shortenElement(spans, selection, selectedId);
                                    //} else if(selected.attr('id') == selection.anchorNode.parentElement.id) {
                                } else if(selectedId == getSelectedIdByAnchorNode($('span#' + selectedId), selection.anchorNode)) {
                                    //console.log('伸ばします');
                                    extendElement(spans, selection, selectedId);
                                }
                            }

                        } else {
                            // anchorNodeとfocusNodeが同じではない
                            // かつ Ctrl + Altが押されている
                            // この場合、anchorNodeまたはfocusNodeの親にselected要素があるかどうか？
                            // 分割
                            var selectedId = selectedIds.pop();

                            if(selectedId == selection.anchorNode.parentNode.id) {
                                // この場合、focusNodeが違う要素である
                                // console.log('focusNode.id', selection.focusNode.parentNode.id);
                            } else if(selectedId == selection.focusNode.parentNode.id) {
                                // この場合、anchorNodeが違う要素である
                                //console.log('anchorNode.id', selection.anchorNode.parentNode.id);
                            }

                            //console.log('分割');
                            separateElement(spans, selection, selectedId);
                        }

                    }

                }
                // 新しい操作をしたらredoは削除
                redoArray = [];
                //sessionStorage.removeItem('redo');
                changeButtonState($('#redo_btn'), []);
                deselect();

                //jsPlumb.repaintEverything();
            }

        }

    }




    $('#edit_btn').click(function() {
        //console.log($(this).attr('src'));
        if($(this).attr('src') == 'images/edit_on_btn.png') {
            //$(this).attr("src", 'images/edit_off_btn.png');

            //isEditMode = false;

            mode = "view";



            $('#always_multiple_btn').prop('disabled', false);

            $('#doc_area span').die('click', clickSpan);

            $('div.instance').die('click', selectInstance);

            $('#doc_area').die('mouseup',  doMouseup);

            unsetCancelSelect();

            changeMode(mode);



        } else {
            //console.log('編集モード');

            //$(this).attr("src", 'images/edit_on_btn.png');


            //isEditMode = true;

            mode = "edit";



            // relationボタンをオフ
            if($('#relation_btn').attr('src') == 'images/relation_on_btn.png') {
                $('#relation_btn').attr('src', 'images/relation_off_btn.png');
            }
            $('#always_multiple_btn').prop('disabled', false);


            setCancelSelect();


            changeMode(mode);
            /*
            if(spans.length > 0) {
                // 選択解除用にこれらの要素をクリックした時は、その親にイベントが伝搬しないようにする

                $("#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
                "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
                 "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
                "table.relation, table.relation tr td, " +
                "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div").live("click", function(event){
                    // eventの伝搬を止める
                    event.stopPropagation();
                });

                // 選択解除
                 $("*:not(#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
                 "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
                    "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
                    "table.relation, table.relation tr td, " +
                    "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div)").live("click", cancelSelect);
            } else {
                console.log('no cancel');
            }
            */


        }
        return false;
    })


    /*
     * span idの最大値を求める
     * spn idの形は T+数字
     */
    function getSpanMaxId() {
        var numId = 0;
        for(i in spans){
            if(parseInt(spans[i]["id"].slice(1)) > numId){
                numId = parseInt(spans[i]["id"].slice(1));
            }
        }
        return numId;
    }

    /*
     * connection idの最大値を求める
     * connection id の形は R + 数字
     */
    function getMaxConnId() {
        var numId = 0;
        for(var i in relations){
            if(parseInt(relations[i]["id"].slice(1)) > numId){
                numId = parseInt(relations[i]["id"].slice(1));
            }
        }
        //console.log("max conn id:", numId);
        return numId;
    }

    /*
     * insansのidの数字部分の最大値を求める
     */
    function getMaxInsannsId() {
        var numId = 0;
        for(var i in insanns){
            if(parseInt(insanns[i]["id"].slice(1)) > numId){
                numId = parseInt(insanns[i]["id"].slice(1));
            }
        }
        //console.log("max insanns id:", numId);
        return numId;
    }

    /*
     * modannsのidの数字部分の最大値を求める
     */
    function getMaxModannsId() {
        var numId = 0;
        for(var i in modanns){
            if(parseInt(modanns[i]["id"].slice(1)) > numId){
                numId = parseInt(modanns[i]["id"].slice(1));
            }
        }
        //console.log("max insanns id:", numId);
        return numId;
    }


    /*
      * マーク新規作成
      */
    function createElement(annoJson, selection) {
        sortSpans(annoJson);

        var anchorRange = document.createRange();
        anchorRange.selectNode(selection.anchorNode);

        var anchorChilds = selection.anchorNode.parentNode.childNodes;
        var focusChilds = selection.focusNode.parentNode.childNodes;

        var absoluteAnchorPosition = getAbsoluteAnchorPosition(anchorChilds, selection);
        var absoluteFocusPosition = getAbsoluteFocusPosition(focusChilds, selection);

        //console.log('absoluteAnchorPosition:', absoluteAnchorPosition);
        //console.log('absoluteFocusPosition:', absoluteFocusPosition);

        // 後ろから選択された場合は、
        // 位置を逆転させる
        var tmpPos;

        if(absoluteAnchorPosition > absoluteFocusPosition) {
            tmpPos = absoluteAnchorPosition;
            absoluteAnchorPosition = absoluteFocusPosition;
            absoluteFocusPosition = tmpPos;
        }

        var startPosition = validateStartDelimiter(absoluteAnchorPosition);
        var endPosition = validateEndDelimiter(absoluteFocusPosition);

        // 新規作成された要素
        var newElem = new Array();
        // 不完全要素
        var partialElem = new Array();

        var now = (new Date()).getTime();

        // idの最大値
        var maxId = getSpanMaxId();

        // annoJsonに追加
        if(isMultiple) {
            // 選択された要素以外で、新たに作られた要素はaryになる
            var ary = findSameString(startPosition, endPosition, spanTypeDefault, annoJson);

            for(var i = 0; i < ary.length; i++) {

                var isAcross = false;

                // ここでjsonのbeginとendが他のjsonにまたがっていないかチェックする
                for(j in annoJson) {
                    if(ary[i]['span']['begin'] > annoJson[j]['span']['begin'] && ary[i]['span']['begin'] < annoJson[j]['span']['end'] && ary[i]['span']['end'] > annoJson[j]['span']['end'] ) {
                        // 開始位置がまたがっているので、不完全要素
                        isAcross = true;
                        ary[i]['span']['begin'] = validateStartDelimiter(annoJson[j]['span']['end']);
                        partialElem.push(ary[i]);
                        break;
                    } else if(ary[i]['span']['begin'] < annoJson[j]['span']['begin'] && ary[i]['span']['end'] > annoJson[j]['span']['begin'] && ary[i]['span']['end'] < annoJson[j]['span']['end']) {
                        // 終了位置がまたがっているので、不完全要素
                        ary[i]['span']['end'] = validateEndDelimiter(annoJson[j]['span']['begin']);
                        partialElem.push(ary[i]);
                        isAcross = true;
                        break;
                    }

                }

                if(!isAcross) {

                    ary[i]['created_at'] = now;

                    maxId = maxId + 1;
                    ary[i]['id'] = "T" + maxId;
                    annoJson.push(ary[i]);
                    newElem.push(ary[i]);
                }

            }
        }


        var obj = new Object();
        obj['span'] = {"begin": startPosition, "end": endPosition};
        //obj['begin'] = startPosition;
        //obj['end'] = endPosition;
        obj['category'] = spanTypeDefault;
        obj['created_at'] = now;
        obj['new'] = true;

        maxId = maxId + 1;
        obj['id'] = "T" + maxId;

        //console.log('annoJson:', annoJson);
        annoJson.push(obj);

        newElem.push(obj);

        // 一旦数字でソート
        sortSpans(annoJson);

        // 一旦空にする
        selectedIds.splice(0, selectedIds.length);

        for(var i in annoJson) {

            if(annoJson[i]['new']) {
                // 選択状態にする
                //console.log('選択されたのは:', annoJson[i]['id']);
                selectedIds.push(annoJson[i]['id']);
                //selectedElements.push(annoJson[i]);
            }

            for(var j in partialElem) {
                if(annoJson[i]['new'] && annoJson[i]['span']['begin'] == partialElem[j]['span']['begin'] && annoJson[i]['span']['end'] == partialElem[j]['span']['end'] && annoJson[i].category == partialElem[j].category) {
                    //console.log("不完全要素は：", i);
                    // 選択状態にする
                    partialIds.push(i);
                }
            }

            // new プロパティを削除
            delete annoJson[i]['new']
        }

        renderSpans(annoJson);
        addCategoryColor(spanTypes);

        saveCurrent("catanns");
    }

    function unsetCancelSelect() {
        //console.log('unsetCancelSelect ');
        $("#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
            "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
            "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
            "table.relation, table.relation tr td, " +
            "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div, " +
            "#ins_area div span.modification, table.modification, table.modification tr td, table.modification tr td div").die("click", function(event){
                // eventの伝搬を止める
                event.stopPropagation();
            });

        // 選択解除
        $("*:not(#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
            "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
            "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
            "table.relation, table.relation tr td, " +
            "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div," +
            "#ins_area div span.modification, table.modification, table.modification tr td, table.modification tr td div)").die("click", cancelSelect);
    }


    function setCancelSelect() {
        //console.log('setCancelSelect ');
        $("#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
            "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
            "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
            "table.relation, table.relation tr td, " +
            "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div" +
            "#ins_area div span.modification, table.modification, table.modification tr td, table.modification tr td div").die("click", function(event){
                // eventの伝搬を止める
                event.stopPropagation();
            });

        $("#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
            "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
            "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
            "table.relation, table.relation tr td, " +
            "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div" +
            "#ins_area div span.modification, table.modification, table.modification tr td, table.modification tr td div").live("click", function(event){
                // eventの伝搬を止める
                event.stopPropagation();
            });

        // 選択解除
        $("*:not(#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
            "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
            "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
            "table.relation, table.relation tr td, " +
            "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div, " +
            "#ins_area div span.modification, table.modification, table.modification tr td, table.modification tr td div)").die("click", cancelSelect);



        $("*:not(#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
            "table.annotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, " +
            "img, form, #load_dialog, #load_btn, :button, :text, :input, " +
            "table.relation, table.relation tr td, " +
            "table.relation tr td div, div.instance, table.instance, table.instance tr td, table.instance tr td div, " +
            "#ins_area div span.modification, table.modification, table.modification tr td, table.modification tr td div)").live("click", cancelSelect);


    }


    /*
     * マークを伸ばす
     */
    function extendElement(annoJson, selection, selectedId) {

        sortSpans(annoJson);
        selectedIds.push(selectedId);

        var range = selection.getRangeAt(0);

        var anchorRange = document.createRange();
        anchorRange.selectNode(selection.anchorNode);

        //console.log('range:', range);

        //console.log('selection.compareBoundaryPoints', range.compareBoundaryPoints(Range.START_TO_START, anchorRange));
        // focusRange の開始点よりも、range の開始点が前なら -1、等しければ 0、後なら 1 を返します。

        if(range.compareBoundaryPoints(Range.START_TO_START, anchorRange) > 0) {
            //console.log('後ろに伸ばします');
            //console.log(selection.focusNode.parentNode);

            // 選択された用素のの親の親と、selection.focusNodeの親が同じでないといけない
            //if(selected.get(0).childNodes[0].parentNode.parentNode == selection.focusNode.parentNode){
            if($('span#' + selectedId).get(0).childNodes[0].parentNode.parentNode == selection.focusNode.parentNode){

                // focusNodeの親ノードの位置を求めます
               // console.log('selection.focusNode.parentNode.id:', selection.focusNode.parentNode.id);
                var offset = 0;

                // focusノードを起点にしたchild node
                var focusChilds = selection.focusNode.parentElement.childNodes;

                // そのspanの文字数を計算
                var len = getFocusPosBySpan(focusChilds, selection);

                //console.log('len:', len);

                if(selection.focusNode.parentNode.id == 'doc_area') {

                } else {
                    offset = findJson(selection.focusNode.parentNode.id)['span']['begin'];
                }
                // 位置修正
                var endPosition = validateEndDelimiter(offset + len + selection.focusOffset);

                findJson(selectedId)['span']['end'] = endPosition;
            }

        } else {

            if($('span#' + selectedId).get(0).childNodes[0].parentNode.parentNode == selection.focusNode.parentNode){
                //console.log('前に伸ばします');
                // focusNodeの親ノードの位置を求めます
                //console.log(selection.focusNode.parentNode.id);
                var offset = 0;

                // focusノードを起点にしたchild node
                var focusChilds = selection.focusNode.parentElement.childNodes;

                // そのspanの文字数を計算
                var len = getFocusPosBySpan(focusChilds, selection);

                if(selection.focusNode.parentNode.id == 'doc_area') {

                } else {
                    offset = findJson(selection.focusNode.parentNode.id)['span']['begin'];
                }

                // 修正
                var startPosition = validateStartDelimiter(offset + len + selection.focusOffset);

                findJson(selectedId)['span']['begin'] = startPosition;

                sortSpans(spans);
            }
        }

        renderSpans(spans);
        addCategoryColor(spanTypes);

        saveCurrent("catanns");

        // instancenの再描画
        renderInstances(insanns);
        addInstypeColor(instanceTypes);

        reMakeConnection();
    }

    /*
     * マークを縮める
     */
    function shortenElement(annoJson, selection, selectedId) {

        sortSpans(annoJson);

        selectedIds.push(selectedId);

        var range = selection.getRangeAt(0);

        var focusRange = document.createRange();
        focusRange.selectNode(selection.focusNode);

        //console.log('selection.compareBoundaryPoints', range.compareBoundaryPoints(Range.START_TO_START, focusRange));
        // focusRange の開始点よりも、range の開始点が前なら -1、等しければ 0、後なら 1 を返します。

        var i;
        var len = spans.length - 1;

        if(range.compareBoundaryPoints(Range.START_TO_START, focusRange) > 0) {
            //console.log('後ろを縮める');
            //console.log('縮める位置は', selection.focusOffset);

            // focusノードを起点にしたchild node
            var focusChilds = selection.focusNode.parentElement.childNodes;

            // そのspanの文字数を計算
            var spanLen = getFocusPosBySpan(focusChilds, selection);

            // 位置修正
            var endPosition = validateEndDelimiter2(findJson(selection.focusNode.parentNode.id)['span']['begin'] + spanLen + selection.focusOffset);

            // 選択範囲がマークの最初と同じであれば、
            // endPositionがマークのbeginよりも大きくなるので、
            // その場合は何もしない
            if(endPosition > findJson(selection.focusNode.parentNode.id)['span']['begin']) {

                findJson(selection.focusNode.parentNode.id)['span']['end'] = endPosition;

                renderSpans(spans);
                addCategoryColor(spanTypes);

                saveCurrent("catanns");
            } else {
                // 結果的に削除
                //console.log('結果的に削除');

                for(i = len; i >= 0; i--) {
                    if(spans[i]['id'] == selectedId) {

                        // このspanに関連するinstance, relation, modificationを削除
                        deleteInstanceAndRelationAndModificationFromSpan(spans[i]['id']);

                        spans.splice(i, 1);
                        selectedIds.pop();
                        break;
                    }
                }

                renderSpans(spans);
                addCategoryColor(spanTypes);

                saveCurrent("catanns_insanns_relanns_modanns");
            }

        } else {
            //console.log('前を縮める');
            //console.log('縮める位置は', selection.focusOffset);

            // focusノードを起点にしたchild node
            var focusChilds = selection.focusNode.parentElement.childNodes;

            // そのspanの文字数を計算
            var spanLen = getFocusPosBySpan(focusChilds, selection);

            // 修正
            var startPosition = validateStartDelimiter2(findJson(selection.focusNode.parentNode.id)['span']['begin'] + spanLen +  selection.focusOffset);

            // 選択範囲がメークの最後と同じであれば、
            // startPositionがマークのendよりも大きくなるので、
            // その場合は何もしない
            if(startPosition < findJson(selection.focusNode.parentNode.id)['span']['end']) {
                //console.log('startPosition:', startPosition);

                findJson(selection.focusNode.parentNode.id)['span']['begin'] = startPosition;

                renderSpans(spans);
                addCategoryColor(spanTypes);
                //setCurrentStorage(spans);

                //saveCurrentCatanns();
                saveCurrent("catanns");

            } else {
                // 結果的に削除
                //console.log('結果的に削除');

                for(i = len; i >= 0; i--) {
                    if(spans[i]['id'] == selectedId) {

                        // このspanに関連するinstance, relation, modificationを削除
                        deleteInstanceAndRelationAndModificationFromSpan(spans[i]['id']);

                        spans.splice(i, 1);
                        selectedIds.pop();
                        break;
                    }
                }

                renderSpans(spans);
                addCategoryColor(spanTypes);
                //setCurrentStorage(spans);

                saveCurrent("catanns_insanns_relanns_modanns");
            }
        }

        // instancenの再描画
        renderInstances(insanns);
        addInstypeColor(instanceTypes);

        reMakeConnectionOnDelete();

        renderModifications(modanns);
        addModtypeColor(modTypes);


        reMakeConnection();
    }

    /*
     * マークを分割する
     */
    function separateElement(annoJson, selection, selectedId) {
        sortSpans(annoJson);

        var anchorChilds = selection.anchorNode.parentNode.childNodes;
        // focusノードを起点にしたchild node
        var focusChilds = selection.focusNode.parentNode.childNodes;

        var absoluteAnchorPosition = getAbsoluteAnchorPosition(anchorChilds, selection);
        var absoluteFocusPosition = getAbsoluteFocusPosition(focusChilds, selection);

        var tmpPos;
        if(absoluteAnchorPosition > absoluteFocusPosition) {
            tmpPos = absoluteAnchorPosition;
            absoluteAnchorPosition = absoluteFocusPosition;
            absoluteFocusPosition = tmpPos;
        }


        // nodeの始点または終点を選択した場合
        var selectedJson = findJson(selectedId);

        //if(absoluteAnchorPosition == annoJson[selectedId]['begin'] ||  absoluteFocusPosition == annoJson[selectedId]['end']) {
        if(absoluteAnchorPosition == selectedJson['span']['begin'] ||  absoluteFocusPosition == selectedJson['span']['end']) {
            //if(startPos == 0) {
            if(absoluteAnchorPosition == selectedJson['span']['begin']) {
                newStart = absoluteFocusPosition;

                //console.log('newStart:', newStart);
                // 修正
                var startPosition = validateStartDelimiter(newStart);

                //console.log('startPosition:', startPosition);

                // 新たな開始点が終了点より小さい場合のみ
                if(startPosition < selectedJson['span']['end']) {
                    //jsonを書き換え
                    //annoJson[selection.anchorNode.parentElement.id]['begin'] = startPosition;
                    selectedJson['span']['begin'] = startPosition;
                }

            } else if(absoluteFocusPosition == selectedJson['span']['end']) {

                //var newEnd = annoJson[selection.anchorNode.parentElement.id]['begin'] + startPos;
                var newEnd = absoluteAnchorPosition;
                // 修正
                var endPosition = validateEndDelimiter(newEnd);
                //jsonを書き換え
                selectedJson['span']['end'] = endPosition;

            }

        } else {
            //console.log('分割　真ん中');

            var newStart = absoluteFocusPosition;
            var newEnd = selectedJson['span']['end'];
            var newLabel = selectedJson['category'];

            var newStartPosition = validateStartDelimiter(newStart);
            var newEndPosition = validateEndDelimiter(newEnd);

            // 分離した前方の終了位置
           // var separatedEndPos = validateEndDelimiter(offset + startPos);
            var separatedEndPos = validateEndDelimiter(absoluteAnchorPosition);

            // 分離した前方の終了位置と分離した後方の終了位置が異なる場合のみ
            if(separatedEndPos != newEndPosition && selectedJson['span']['begin'] != newStartPosition) {
                //jsonを書き換え
                //annoJson[selection.anchorNode.parentElement.id]['end'] = separatedEndPos;
                selectedJson['span']['end'] = separatedEndPos;

                var maxId = getSpanMaxId();
                maxId = maxId + 1;
                // 新しいjsonを追加
                var obj = new Object();
                obj['span'] = {"begin": newStartPosition, "end": newEndPosition};
                //obj['begin'] = newStartPosition;
                //obj['end'] = newEndPosition;
                obj['category'] = newLabel;
                obj['created_at'] = selectedJson['created_at'];
                obj['id'] = "T" + maxId;
                annoJson.push(obj);
            }
        }

        sortSpans(spans);

        selectedIds.splice(0, selectedIds.length);
        selectedIds.push(selectedId);

        renderSpans(spans);
        addCategoryColor(spanTypes);
        //setCurrentStorage(spans);
        //saveCurrentCatanns();

        saveCurrent("catanns");

        // instancenの再描画
        renderInstances(insanns);
        addInstypeColor(instanceTypes);

        reMakeConnection();
    }


    // マークの削除
    function removeElement(annoJson, selection, selectedId) {
        sortSpans(spans);

        var range = selection.getRangeAt(0);

        var focusRange = document.createRange();
        focusRange.selectNode(selection.focusNode);

        if((range.compareBoundaryPoints(Range.START_TO_END, focusRange) == 1) && (range.compareBoundaryPoints(Range.END_TO_END, focusRange) == -1)) {

            //var num = selectedId;
            //console.log('削除:', num);

            var i;
            var len = spans.length - 1;
            for(i = len; i >= 0; i--) {
                if(spans[i]['id'] == selectedId) {

                    deleteInstanceAndRelationAndModificationFromSpan(spans[i]["id"]);

                    spans.splice(i, 1);
                    selectedIds.pop();
                    break;
                }
            }

            renderSpans(spans);
            addCategoryColor(spanTypes);
            //setCurrentStorage(spans);

            // instancenの再描画
            renderInstances(insanns);
            addInstypeColor(instanceTypes);

            reMakeConnectionOnDelete();

            saveCurrent("catanns_insanns_relanns_modanns");
        }
    }


    /*
     * anchorNodeはselectedの内側にあるか
     */
    function getSelectedIdByAnchorNode(selected, anchorNode) {

        var anchorRange = document.createRange();
        anchorRange.selectNode(anchorNode);

        // 選択用素のレンジ
        var selectedRange = document.createRange();
        selectedRange.selectNode(selected.get(0).childNodes[0]);

        //console.log('始点範囲比較:', anchorRange.compareBoundaryPoints(Range.START_TO_START, selectedRange));
        //console.log('終点範囲比較:', anchorRange.compareBoundaryPoints( Range.END_TO_END, selectedRange ))

        if(anchorRange.compareBoundaryPoints(Range.START_TO_START, selectedRange) > 0 && anchorRange.compareBoundaryPoints( Range.END_TO_END, selectedRange ) > 0) {
            // anchorNodeのspan選択用素の中にあれば、選択用素のIDを返す
            //console.log('selected.id:',selected.attr('id'))
            return selected.attr('id');
        }

        // anchorNodeが選択用素の中に無い場合は、anchoreNodeのidを返す
        //console.log('anchorNode:', anchorNode)
        //console.log('anchoreNode.id:',anchorNode.parentElement.id);
        return anchorNode.parentElement.id;

    }


    /*
     * span idをもとに、それに関するinstance,relation,modificationを削除する
     */
    function deleteInstanceAndRelationAndModificationFromSpan(id) {
        // idはspansのid
        //console.log('id:', id);

        var i;


        // 削除されるインスタンスのid
        var deleteInsIds = new Array();

        // 削除されるrelationのid
        var deleteRelIds = new Array();

        // このspan要素に関するinsatnceを削除
        var len = insanns.length - 1;
        for(i = len; i >= 0; i--) {
            var ins = insanns[i];
            if(ins["object"] == id) {
                deleteInsIds.push(ins["id"]);
                insanns.splice(i, 1);
            }
        }

        // このspan要素に関するrelationを削除する
        var len = relations.length - 1;
        for(i = len; i >= 0; i--) {
            var conn = relations[i];
            if(conn["subject"] == id || conn["object"] == id)  {
                deleteRelIds.push(conn["id"]);
                relations.splice(i, 1);
            }
        }

        // 削除されるinstanceに関するrelationを削除する
        var len = relations.length - 1;
        for(i = len; i >= 0; i--) {
            var conn = relations[i];
            for(var j in deleteInsIds) {
                if(conn["subject"] == deleteInsIds[j] || conn["object"] == deleteInsIds[j] ) {
                    relations.splice(i, 1);
                }
            }
        }

        // 削除されるinstanceに関するmodificationを削除
        var len = modanns.length - 1;
        for(i = len; i >= 0; i--) {
            var mod = modanns[i];

            for(var j in deleteInsIds) {
                if(mod["object"] == deleteInsIds[j]) {
                    modanns.splice(i, 1);
                }
            }

        }

        // 削除されるrelationに関するmodificationを削除
        var len = modanns.length - 1;
        for(i = len; i >= 0; i--) {
            var mod = modanns[i];

            for(var j in deleteRelIds) {
                if(mod["object"] == deleteRelIds[j]) {
                    modanns.splice(i, 1);
                }
            }

        }
    }


    /*
     * 同じ文字列を探す
     * ただし、両外側はdelimiterであること
     */
    function findSameString(startPos, endPos, spanTypeDefault, annoJson) {
        var document = $('#src_area').text();
        var searchStr = document.substring(startPos, endPos);
        var strLen = endPos - startPos;

        var ary = new Array();

        var from = 0;
        while(true) {
            var sameStrPos = document.indexOf(searchStr, from);
            if(sameStrPos == -1) {
                break;
            }

            //console.log('同じ文字は:', sameStrPos);

            if(!isOutsideDelimiter(document, sameStrPos, sameStrPos + strLen)) {
                var obj = new Object();
                obj['span'] = {"begin": sameStrPos, "end": sameStrPos + strLen};
                //obj['begin'] = sameStrPos;
                //obj['end'] = sameStrPos + strLen;
                obj['category'] = spanTypeDefault;
                obj['new'] = true; // 新しくつくられた

                var isExist = false;

                for(var i = 0; i < annoJson.length; i++) {
                    if(annoJson[i]['span']['begin'] == obj['span']['begin'] && annoJson[i]['span']['end'] == obj['span']['end'] && annoJson[i].category == obj.category) {
                        isExist = true;
                        break;
                    }
                }

                // マウスでマークされた物以外の同じ文字列
                if(!isExist && startPos != sameStrPos) {
                    ary.push(obj);
                }

            }
            from = sameStrPos + 1;
        }

        return ary;

    }

    /*
     * focusNode上で、そのnodeまでの位置を求める
     */
    function getFocusPosBySpan(childNodes, selection) {
        var len = 0;

        //console.log('childNodes:', childNodes);

        for(var i = 0; i < childNodes.length; i++) {

            // docareaChilds[i]がfocusNodeならば、繰り返しを抜ける
            if(childNodes[i] == selection.focusNode) {
                //console.log('breakします')
                break;
            }

            if(childNodes[i].nodeName == "#text") {
                // text nodeであれば、textの長さ
                len += childNodes[i].nodeValue.length;
            } else {
                // text modeでなけばspanノードなので、
                // そのIDを取得して、文字列の長さを取得
                len += $('#' + childNodes[i].id).text().length;
            }
        }

        return len;
    }

    /*
     * anchorNode上で、そのnodeまでの位置を求める
     */
    function getAnchorPosBySpan(childNodes, selection) {
        var len = 0;

        for(var i = 0; i < childNodes.length; i++) {

            // docareaChilds[i]がanchorNodeならば、繰り返しを抜ける
            if(childNodes[i] == selection.anchorNode) {
                //console.log('breakします')
                break;
            }

            if(childNodes[i].nodeName == "#text") {
                // text nodeであれば、textの長さ
                len += childNodes[i].nodeValue.length;
            } else {
                // text modeでなけばspanノードなので、
                // そのIDを取得して、文字列の長さを取得
                len += $('#' + childNodes[i].id).text().length;
            }
        }

        return len;
    }



    /*
     * focusNode上で、その絶対位置を求める
     */
    function getAbsoluteFocusPosition(childNodes, selection) {
        var pos = 0;

        if(selection.focusNode.parentNode.nodeName == 'SPAN' && selection.focusNode.parentNode.id != "doc_area") {

            pos = findJson(selection.focusNode.parentNode.id)['span']["begin"];
        }

        for(var i = 0; i < childNodes.length; i++) {

            // docareaChilds[i]がfocusNodeならば、繰り返しを抜ける
            if(childNodes[i] == selection.focusNode) {
                pos += selection.focusOffset;
                break;
            }

            if(childNodes[i].nodeName == "#text") {
                // text nodeであれば、textの長さ
                pos += childNodes[i].nodeValue.length;
            } else {
                // text modeでなけばspanノードなので、
                // そのIDを取得して、文字列の長さを取得
                pos += $('#' + childNodes[i].id).text().length;
            }
        }
        return pos;
    }

    /*
     * anchorNode上で、その絶対位置を求める
     */
    function getAbsoluteAnchorPosition(childNodes, selection) {
        var pos = 0;

        if(selection.anchorNode.parentNode.nodeName == 'SPAN' && selection.anchorNode.parentNode.id != "doc_area") {
         pos = findJson(selection.anchorNode.parentNode.id)['span']["begin"];
        }

        for(var i = 0; i < childNodes.length; i++) {

            // docareaChilds[i]がanchorNodeならば、繰り返しを抜ける
            if(childNodes[i] == selection.anchorNode) {
                pos += selection.anchorOffset;
                break;
            }

            if(childNodes[i].nodeName == "#text") {
                // text nodeであれば、textの長さ
                pos += childNodes[i].nodeValue.length;
            } else {
                // text modeでなけばspanノードなので、
                // そのIDを取得して、文字列の長さを取得
                pos += $('#' + childNodes[i].id).text().length;
            }
        }

        return pos;
    }


    /*
     * multipleで作った時に、選択文字列の両外側がdelimiterであるかどうか
     */
    function isOutsideDelimiter(document, startPos, endPos) {
        var outOfBeginChar = document.charAt(startPos-1);
        var outOfEndChar = document.charAt(endPos);

        //console.log('開始文字の外側:',outOfBeginChar );
        //console.log('終了文字の外側', outOfEndChar);

        var outOfBegin = searchDelimitChar(outOfBeginChar);
        var outOfEnd = searchDelimitChar(outOfEndChar);

        //console.log('delimiter?:', outOfBegin, ':', outOfEnd);

        if(outOfBegin < 0 || outOfEnd < 0) {
            return true;
        }
        return false;
    }


    /*
     * idのjsonを求める
     */
    function findJson(id) {
        for(i in spans) {
            if(spans[i]['id'] == id) {
                return spans[i];
            }
        }
        return null;
    }

    /*
    * ブラウザデフォルトの選択解除
    */
    function deselect() {
        if (window.getSelection){
            var selection = window.getSelection();
            selection.collapse(document.body, 0);
        } else {
            var selection = document.selection.createRange();
            selection.setEndPoint("EndToStart", selection);
            selection.select();
        }
    }


    /*
     * キーダウン
     */
    $(document).keydown(function(e){
        //console.log('keyCode:', e.keyCode);
        //console.log('e.ctrlKey:', e.ctrlKey);

        if(mode == "relation") {
            // relation mode
            // win delete
            // mac fn + delete
            if(e.keyCode == 46) {

                //var isDeleteRel = false;// relationの削除
                //var isDeleteMod = false; // modificationの削除

                for(i in selectedConns){
                    var endpoints = selectedConns[i].endpoints;
                    var id = selectedConns[i].getParameter("connId");

                    jsPlumb.deleteEndpoint(endpoints[0]);
                    jsPlumb.deleteEndpoint(endpoints[1]);

                    var len = relations.length - 1;
                    for(k = len; k >= 0; k--) {
                        if(relations[k]["id"] == id) {
                            //console.log('削除するconnection id:', id);
                            relations.splice(k, 1);
                            //isDeleteRel = true;
                        }
                    }

                }

                // table再描画
                selectedConns.splice(0, selectedConns.length);
                //setCurrentConnStorage(relations);

                if(selectedModificationIds.length > 0) {
                    deleteModification();
                }

                saveCurrent("catanns_insanns_relanns_modanns");

            } else if((!e.ctrlKey  && e.keyCode == 191) || (!e.ctrlKey && e.keyCode == 83)) {
                // ?キー
                // sキー
                // modificatinを作る
                createModification("Speculation");
                //selectedConns.splice(0, selectedConns.length);

                } else if((!e.ctrlKey && e.keyCode == 78) || (!e.ctrlKey && e.keyCode == 88)) {

                //console.log('create modification');
                // xキー
                // nキー
                createModification("Negation");
                //selectedConns.splice(0, selectedConns.length);

            } else if(e.keyCode == 17) {
                //console.log('set ctrlKey');
                // Ctrlキー
                isCtrl = true;
            } else if(e.keyCode == 16) {
                isShift = true;
            }

        } else if(mode == "edit") {

            // win ctrl
            // mac command
            if(($.os.name != "mac" && e.keyCode == 17) || ($.os.name == "mac" && e.keyCode == 224)) {
                isCtrl = true;
            }

            if(e.keyCode == 16) {
                isShift = true;
            }

            // win ctrl + alt
            // mac command + option
            if(isCtrl && e.keyCode == 18) {
                isCtrlAlt = true;
            }

            // delete key
            // win delete
            // mac fn + delete
            if(e.keyCode == 46) {

                //console.log('削除');

                //var isDeleteCat = false;
                //var isDeleteRel = false; // relationも同時に削除されるか
                //var isDeleteIns = false; // instanceも同時に削除されるか
                //var isDeleteMod = false; // modificationも同時に削除されるか


                var deleteConns = new Array();

                //削除
                if(selectedIds.length > 0) {

                    //isDeleteCat = true;

                    for(var i in selectedIds) {
                        var selectedId = selectedIds[i];

                        var len = spans.length - 1;
                        var j;

                        for(j = len; j >= 0; j--){
                            if(spans[j]['id'] == selectedId) {
                                // span要素が削除される場合、そのインスタンスも削除される
                                for(var n in insanns) {
                                    if(insanns[n]["object"] == selectedId) {
                                        selectedInstanceIds.push(insanns[n]["id"]);
                                        //isDeleteIns = true;
                                    }

                                }
                                spans.splice(j, 1);
                            }
                        }

                        len = relations.length - 1;
                        for(j = len; j >= 0; j--){
                            var conn = relations[j];
                            if(conn.subject == selectedId || conn.object == selectedId) {
                                deleteConns.push(conn);
                                relations.splice(j, 1);
                               // isDeleteRel = true;
                            }
                        }

                        len = tmpHidedRelations.length - 1;
                        for(j = len; j >= 0; j--){
                            var conn = tmpHidedRelations[j];
                            if(conn.subject == selectedId || conn.object == selectedId) {
                                deleteConns.push(conn);
                                tmpHidedRelations.splice(j, 1);
                                //isDeleteRel = true;
                            }
                        }
                    }


                    // 空にする
                    selectedIds.splice(0, selectedIds.length);

                    renderSpans(spans);
                    addCategoryColor(spanTypes);
                    //setCurrentStorage(spans);

                   // renderInstances(insanns);
                   // addInstypeColor(instanceTypes);
                }

                //
                if(selectedInstanceIds.length > 0) {


                    for(var i in selectedInstanceIds) {
                        var selectedId = selectedInstanceIds[i];
                        //console.log('削除されるインスタンス:', selectedId);
                        //isDeleteIns = true;

                        var len = insanns.length - 1;
                        var k;

                        for(k = len; k >= 0; k--){
                            if(insanns[k]['id'] == selectedId) {
                                insanns.splice(k, 1);
                            }
                        }

                        len = relations.length - 1;
                        for(k = len; k >= 0; k--){
                            var conn = relations[k];
                            if(conn.subject == selectedId || conn.object == selectedId) {
                                // 削除されるrelationのidを確保
                                deleteConns.push(conn);

                                relations.splice(k, 1);
                                //isDeleteRel = true;
                            }
                        }

                        len = tmpHidedRelations.length - 1;
                        for(k = len; k >= 0; k--){
                            var conn = tmpHidedRelations[k];
                            if(conn.subject == selectedId || conn.object == selectedId) {
                                // 削除されるrelationのidを確保
                                deleteConns.push(conn["id"]);

                                tmpHidedRelations.splice(k, 1);
                                //isDeleteRel = true;
                            }
                        }

                        len = modanns.length - 1;
                        for(k = len; k >= 0; k--) {
                            var mod = modanns[k];
                            if(mod["object"] == selectedId) {
                                // instanceの削除に伴って、modificationも削除
                                modanns.splice(k, 1);
                                //isDeleteMod = true;
                            }
                        }

                    }

                    // relationの削除に伴って、削除されるmodificationがあるか
                    for(var i in deleteConns) {
                        var conn = deleteConns[i];

                        len = modanns.length - 1;
                        for(k = len; k >= 0; k--){
                            var mod = modanns[k];
                            if(conn["id"] == mod["object"]){
                                modanns.splice(k, 1);
                                //isDeleteMod = true;
                            }

                        }
                    }


                    selectedInstanceIds.splice(0, selectedInstanceIds.length);

                    renderInstances(insanns);
                    addInstypeColor(instanceTypes);
                }

                // さらに、relationsからtmpHiderelationsで削除されたconnを削除する
                len = relations.length - 1;
                for(i = len; i >= 0; i--){
                    var conn = relations[i];
                    for(var j in deleteConns) {
                        if(conn == deleteConns[j]) {
                            relations.splice(i, 1);
                        }
                    }
                }

                // relationを書き直し
                reMakeConnectionOnDelete();

                deleteModification();

                saveCurrent("catanns_insanns_relanns_modanns");

            } else if(e.keyCode == 73) {
                // Iキー
                // インスタンスを作る
                //console.log('Iキー');
                createInstance();
                reMakeConnection();

            } else if((!e.ctrlKey && e.keyCode == 191) || (!e.ctrlKey && e.keyCode == 83)) {
                // ?キー
                // sキー
                // modificatinを作る
                createModification("Speculation");
            } else if((!e.ctrlKey && e.keyCode == 78) || (!e.ctrlKey && e.keyCode == 88)) {
                // xキー
                // nキー
                createModification("Negation");
            }

            // z(90)で選択要素を前に
            // x(88)で選択要素を次に
            //console.log('isCtrl:', isCtrl);
            //console.log('isCtrlAlt:', isCtrlAlt);

            if(e.keyCode == 90 && !e.ctrlKey && selectedIds.length == 1) {

                selectedIds.splice(0, selectedIds.length);
                sortSpans(spans);

                if(selectedIdOrder > 0) {
                    selectedIdOrder--;
                } else {
                    selectedIdOrder = spans.length - 1;

                }

                selectedId = spans[selectedIdOrder]['id'];
                selectedIds.push(selectedId);

                renderSpans(spans);
                addCategoryColor(spanTypes);

            } else if(e.keyCode == 88 && !e.ctrlKey && selectedIds.length == 1) {

                selectedIds.splice(0, selectedIds.length);
                sortSpans(spans);

                if(selectedIdOrder < spans.length -1) {
                    selectedIdOrder++;
                } else {
                    selectedIdOrder = 0;

                }
                selectedId = spans[selectedIdOrder]['id'];
                selectedIds.push(selectedId);

                renderSpans(spans);
                addCategoryColor(spanTypes);
            }

            /*
            if(e.ctrlKey) {
                if(e.keyCode == 90 && undoArray.length > 0) {
                    // 選択状態は解除
                    selectedIds.splice(0, selectedIds.length);
                    selectedInstanceIds.splice(0, selectedInstanceIds.length);
                    selectedModificationIds.splice(0., selectedModificationIds.length);

                    console.log('doUndo');
                    // undo
                    doUndo();
                } else if(e.keyCode == 88 && redoArray.length > 0) {
                    // 選択状態は解除
                    selectedIds.splice(0, selectedIds.length);
                    selectedInstanceIds.splice(0, selectedInstanceIds.length);
                    selectedModificationIds.splice(0., selectedModificationIds.length);

                    console.log('doRedo');
                    // redo
                    doRedo();
                }
            }
            */

        }

        if(e.ctrlKey) {


            //console.log('undoNameArray.length:', undoNameArray.length);
            //console.log('redoNameArray.length:', redoNameArray.length);

            if(e.keyCode == 90 && undoNameArray.length > 0) {

                //console.log("--undo--");
                // 選択状態は解除
                selectedIds.splice(0, selectedIds.length);
                selectedInstanceIds.splice(0, selectedInstanceIds.length);
                selectedConns.splice(0,selectedConns.length);
                selectedModificationIds.splice(0., selectedModificationIds.length);

                // undo
                doUndo();
            } else if(e.keyCode == 88 && redoNameArray.length > 0) {
                //console.log("--redo--");
                // 選択状態は解除
                selectedIds.splice(0, selectedIds.length);
                selectedInstanceIds.splice(0, selectedInstanceIds.length);
                selectedConns.splice(0,selectedConns.length);
                selectedModificationIds.splice(0., selectedModificationIds.length);

                // redo
                doRedo();
            }
        }

    });

    /*
     * キーアップ
     */
    $(document).keyup(function(e){
        // ctrlキー
        // win,mac共通
        if(($.os.name != "mac" && e.keyCode == 17) || ($.os.name == "mac" && e.keyCode == 224)) {
            isCtrl = false;
        }
        // win:altキー,mac:optionキー
        if(e.keyCode == 18) {
            isCtrlAlt = false;
        }

        if(e.keyCode == 16) {
            isShift = false;
        }

    });


    function createInstance() {

        //var annset = insanns[0]["annset"];
        //var type = insanns[0]["type"];
        var type = "subClassOf";

        selectedInstanceIds.splice(0, selectedInstanceIds.length);

        if(selectedIds.length > 0) {


            //console.log('instance max id;', maxId);
            for(var i in selectedIds) {
                //console.log('選択されたspan:', selectedIds[i]);

                var instance = new Object();
                var id = "E" + (getMaxInsannsId() + 1);
                instance["id"] = id;
                //instance["annset"] = annset;
                instance["object"] = selectedIds[i];
                instance["type"] = type;
                instance["created_at"] = (new Date()).getTime();

                //console.log('instance id:', instance["id"]);

                insanns.push(instance);
                selectedInstanceIds.push(id);
            }

        }
        renderInstances(insanns);
        addInstypeColor(instanceTypes);
        //setCurrentInsannsStorage(insanns);

        saveCurrent("insanns");

        // 選択されたspan要素は選択をはずす
        // span編集モードの選択を削除
        selectedIds.splice(0, selectedIds.length);
        $('#doc_area span').removeClass('selected').removeClass('partialSelected');
        $('table.annotation').removeClass('t_selected').removeClass('t_partialSelected');
        $('table.annotation .removeBtn').hide();

    }

    /*
     * instanceの選択
     */
    function selectInstance(e) {
        e.preventDefault();
        //console.log('click span');
        //console.log('shiftキーが押されている:', e.shiftKey);

        // 下に重なってる要素のclickイベントを解除
        $('#doc_area span').unbind('click',arguments.callee);

        if(mode == "relation") {
            var id = $(this).attr('id').split('_')[1];

            if(sourceElem == null) {
                //console.log('here');
                sourceElem = $('#' + id);
                sourceElem.css('border-color', '#000000').addClass('ins_selected').attr('id');
            } else {
                targetElem = $('#' + id);

                //console.log('there');

                // 色の指定
                var color = relationTypes[relationTypeDefault]["color"];

                // rgbaに変換
                var rgba = colorTrans(color);

                // connection作成
                var connId = "R" + (getMaxConnId() + 1);

                var subject = sourceElem.attr('id');
                var object = targetElem.attr('id');

                // 選択されているものは選択をはずす
                deselectConnection();

                var obj = new Object();
                obj.subject = subject;
                obj.object = object;
                obj.type = relationTypeDefault;
                obj.id = connId;
                obj.created_at = (new Date()).getTime();

                // distanceをつける
                addDistanceToRelation(obj);

                if(e.shiftKey) {
                    // targetを次のソースにする
                    e.preventDefault();
                    deselect();

                    /*
                    // instanceの枠の色を元に戻す
                    $('div.instance').map(function() {
                        if($(this).hasClass('ins_selected')){
                            $(this).removeClass('ins_selected');

                            addInstanceBorderColor($(this), spanTypes);
                         }
                     });
                    */

                    if(sourceElem.hasClass('source_selected')) {
                        sourceElem.removeClass('source_selected');
                        sourceElem = null;

                        sourceElem = targetElem;
                        sourceElem.addClass('source_selected');
                    } else if(sourceElem.hasClass('ins_selected')) {
                        $('#' + id).removeClass('ins_selected');

                        addInstanceBorderColor($('#' + id), spanTypes);
                        sourceElem = null;
                        sourceElem = targetElem;
                        sourceElem.css('border-color', '#000000').addClass('ins_selected').attr('id');
                    }

                } else if(e.ctrlKey) {
                    // sourceは元のまま
                    targetElem = null;
                } else {
                    sourceElem.removeClass('source_selected');

                    // instanceの枠の色を元に戻す
                    $('div.instance').map(function() {
                        if($(this).hasClass('ins_selected')){
                            $(this).removeClass('ins_selected');

                            addInstanceBorderColor($(this), spanTypes);
                        }
                    });

                    sourceElem = null;
                    targetElem = null;

                }

                relations.push(obj);

                sortConnByDistance(relations);

                // 書きなおし
                jsPlumb.reset();
                for(var j in relations) {
                    var conn = relations[j];
                    var sId = conn['subject'];
                    var tId = conn['object'];

                    var color = relationTypes[conn['type']]["color"];
                    var rgba = colorTrans(color);
                    var id = conn['id'];
                    var type = conn['type'];

                    if(id == connId) {
                        var rgbas = rgba.split(',');
                        rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',1)';

                        var c = makeConnection(sId, tId, type, rgba, id, "selected", modanns);
                        selectedConns.push(c);
                    } else {
                        makeConnection(sId, tId, type, rgba, id, "unselected", modanns);
                    }

                }

                //setCurrentConnStorage(relations);
                saveCurrent("relanns");
            }

            //console.log('sourceElem2:', sourceElem);

        } else {
            // editモード
            //console.log('select instance');

            if(isCtrl) {
                //console.log('ctrlキーが押されています');
                var id = $(this).css('border-color', '#000000').addClass('ins_selected').attr('id');

                // 該当するテーブルを選択状態にする
                $('#instance_t_' + $(this).attr('id')).addClass('t_selected');

                // remove_btnを表示
                $('.instance.t_selected .removeBtn').show();

                selectedInstanceIds.push(id);
            } else {
                // 一旦選択を解除
                var elem = $('.ins_selected').removeClass('ins_selected');
                addInstanceBorderColor(elem, spanTypes);
                // remove_btnを表示
                $('#insannstable .removeBtn').hide();
                $('#insannstable .t_selected').removeClass('t_selected');

                selectedInstanceIds.splice(0, selectedInstanceIds.length);

                var id = $(this).css('border-color', '#000000').addClass('ins_selected').attr('id');

                // 該当するテーブルを選択状態にする
                $('#instance_t_' + $(this).attr('id')).addClass('t_selected');

                // remove_btnを表示
                $('.instance.t_selected .removeBtn').show();

                selectedInstanceIds.push(id);
            }
        }
    }


    function createModification(type) {
        var i;

        if(mode == "relation") {
            //console.log('選択されたrelationの数:', selectedConns.length);

            for(i = 0; i <  selectedConns.length; i++) {
                var conn = selectedConns[i];

                var obj = new Object();
                obj["type"] = type;
                obj["object"] = conn.getParameter("connId");
                //console.log('connId:', conn.getParameter("connId"));
                //console.log('max id:', getMaxModannsId() + 1);
                obj["id"] = "M" + (getMaxModannsId() + 1);
                obj['created_at'] = (new Date()).getTime();

                modanns.push(obj);

                // 選択状態にする
                selectedModificationIds.push(obj["id"]);
            }

            selectedConns.splice(0, selectedConns.length);


            //console.log('selectedConns.length:', selectedConns.length);

            // relationテーブルの色の枠をもとに戻す
            // remove_btnを表示
            $('#relationtable .removeBtn').hide();
            $('#relationtable .t_selected').removeClass('t_selected');

        } else if(mode == "edit") {
            //console.log("here");
            for(i = 0; i < selectedInstanceIds.length; i++) {

                var ins = selectedInstanceIds[i];

                var obj = new Object();
                obj["type"] = type;
                obj["object"] = ins;
                //console.log('instance id:',ins);
                obj["id"] = "M" + (getMaxModannsId() + 1);
                obj['created_at'] = (new Date()).getTime();
                modanns.push(obj);



                selectedModificationIds.push(obj['id']);
            }


            // instanceの枠の色を元に戻す
            $('div.instance').map(function() {
                if($(this).hasClass('ins_selected')){
                    $(this).removeClass('ins_selected');

                    addInstanceBorderColor($(this), spanTypes);

                }
            });

            // remove_btnを表示
            $('#insannstable .removeBtn').hide();
            $('#insannstable .t_selected').removeClass('t_selected');



            selectedInstanceIds.splice(0, selectedInstanceIds.length);
        }

        renderModifications(modanns);
        addModtypeColor(modTypes);

        //saveCurrentModanns();
        saveCurrent("modanns");

    }


    function selectInsModification(e) {

        // clickイベントの伝搬停止
        e.stopPropagation();

        //console.log('select modification:', $(this));


        var id = $(this).attr('id');

        if(e.ctrlKey) {
            //console.log('ctrlがおされています');
            $(this).addClass('mod_selected');

            // 該当するテーブルを選択状態にする
            $('#modification_t_' + $(this).attr('id')).addClass('t_selected');
            // remove_btnを表示
            $('.modification.t_selected .removeBtn').show();

            selectedModificationIds.push(id);
        } else {
            // 一旦選択を解除
            unselectModification();

            $(this).addClass('mod_selected');

            // 該当するテーブルを選択状態にする
            $('#modification_t_' + $(this).attr('id')).addClass('t_selected');
            // remove_btnを表示
            $('.modification.t_selected .removeBtn').show();

            selectedModificationIds.push(id);
        }


    }


    function deleteModification() {

        //console.log('deleteModification');
        //console.log('selectedModificationIds.length:', selectedModificationIds.length);

        for(var i in selectedModificationIds) {

            // 選択されているmodificationは
            var selectedModId = selectedModificationIds[i];

            var k;
            var len = modanns.length - 1;
            for(var k = len; k >= 0; k--) {
                if(modanns[k]['id'] == selectedModId) {
                    //console.log('spliceします');
                    modanns.splice(k, 1);
                }
            }


            var conns = getConnectionData();

            for(var j in conns) {
                var conn = conns[j];

                var labelText = "";
                var modId = "";
                for(var i = 0; i < conn.overlays.length; i++) {
                    var overlay = conn.overlays[i];
                    //console.log('label:', overlay["type"]);

                    if(overlay["type"] == "Label") {
                        //console.log(overlay.getLabel());
                        labelText = overlay.getLabel();
                        modId = overlay["id"];

                        if(selectedModId == modId) {
                            //

                            var connId = conn["id"];
                            var subject = conn["subject"];
                            var object = conn["object"]
                            var rgba = conn["paintStyle"];
                            var endpoints = conn["endpoints"];
                            var type = conn['type'];

                            jsPlumb.deleteEndpoint(endpoints[0]);
                            jsPlumb.deleteEndpoint(endpoints[1]);

                            var c = makeConnection(subject, object, type, rgba, connId, "unselected", modanns);
                        }
                    }
                }
            }
        }

        renderModifications(modanns);
        addModtypeColor(modTypes);

        //saveCurrentModanns();
        selectedModificationIds.splice(0, selectedModificationIds.length);
    }


    /*
     * カテゴリー適用ボタン
     */
    $('.category_apply_btn').live('click', function() {
        // 選択されているannotationテーブルのcategoryに適用
        for (var i in selectedIds) {

            for (var j in spans){
                //console.log('json.id:', parseInt(spans[j]['id']));

                var applyJson = spans[j];

                if (applyJson['id'] == selectedIds[i]) {
                    applyJson['category'] = $(this).text();

                    renderSpans(spans);
                    addCategoryColor(spanTypes);
                }
            }
        }
        //setCurrentStorage(spans);
        //saveCurrentCatanns();
        if (selectedIds.length > 0) {
            saveCurrent("catanns");
        }
    });

    /*
     * 関係適用ボタン
     */
    $('.relation_apply_btn').live('click', function() {
        if(selectedConns.length > 0) {
            for(i in selectedConns) {

                var conn = selectedConns[i];

                //console.log('適用されるconn:', conn);

                var source = conn.source;
                var target = conn.target;
                var endpoints = conn.endpoints;
                var connId = conn.getParameter("connId");
                var type = $(this).text();

                var color = $(this).parent().css('backgroundColor');

                var rgba = color.substr(0, color.length -1) + ',' + connOpacity + ')';
                rgba = rgba.replace('rgb', 'rgba');

                jsPlumb.deleteEndpoint(endpoints[0]);
                jsPlumb.deleteEndpoint(endpoints[1]);

                var subject = source.attr('id');
                var object = target.attr('id');

                //var conn = makeConnection(source, target, type, rgba, connId);
                //var conn = makeConnection(subject, object, type, rgba, connId, "unselected", labelText, modId, "");
                var conn = makeConnection(subject, object, type, rgba, connId, "unselected", modanns);

                var source_id = conn.sourceId;
                var target_id = conn.targetId;
                var rgba = conn.paintStyleInUse["strokeStyle"];
                var type = conn.getParameter("type");
                var id = conn.getParameter("connId");

                var obj = new Object();
                obj.source_id = source_id;
                obj.target_id = target_id;
                obj.type = type;
                obj.id = id;

                // relationsの中身を入れ替える
                for(var j in relations) {
                    if(relations[j]["id"] == id) {
                        //console.log('relationsを書き換え:', id);
                        relations[j] = obj;
                        break;
                    }
                }
            }

            selectedConns.splice(0, selectedConns.length);

            //setCurrentConnStorage(relations);
            //saveCurrentRelanns();
            saveCurrent("relanns");
        }
    });


    /*
     * modificatio0n適用ボタン
     */
    $('.modtype_apply_btn').live('click', function() {
        for(var i in selectedModificationIds) {
            var modId = selectedModificationIds[i];

            for(var j in modanns) {
                var mod = modanns[j];

                if(modId == mod["id"]) {
                    mod['type'] = $(this).text();
                }
            }
        }

        renderModifications(modanns);
        addModtypeColor(modTypes);

        saveCurrent("modanns");
    });


    /*
    * annotation list上で選択
    */
    function selectAnnotationTable(e) {

        var  selectedId;
        var tagName = $(this).get(0).tagName;

        if(tagName == 'TD') {
            selectedId =  $(this).parent().parent().parent().attr('id').split('_')[1].valueOf();
        } else if(tagName == 'DIV') {
            selectedId =  $(this).parent().parent().parent().parent().attr('id').split('_')[1].valueOf();
        }

        if(isCtrl) {
            //console.log('複数選択');

            selectedIds.push(selectedId);

            // selectedを削除して、class指定が空になった要素はclass="noCategoy"にする
            //$('#doc_area span[class=""]').addClass('noCategory');
            $('span#' + selectedId).addClass('selected');

            if(tagName == 'TD') {
                $(this).parent().parent().parent().addClass('t_selected');
            } else if(tagName == 'DIV') {
                $(this).parent().parent().parent().parent().addClass('t_selected');
            }

            $('.annotation.t_selected .removeBtn').show();

        } else if(isShift && selectedIds.length == 1) {

            e.preventDefault();

            //console.log("shiftキーが押されています");

            var firstId = selectedIds.pop();
            selectedIds.splice(0, selectedIds.length);

            var firstTable = $('#t_' + firstId);

            var lastTable;

            if(tagName == 'TD') {
                lastTable = $(this).parent().parent().parent().parent();
            } else if(tagName == 'DIV') {
                lastTable = $(this).parent().parent().parent().parent();
            }

            var firstIndex;
            var lastIndex;

            $('table.annotation').map(function(i){
                var id = $(this).attr('id').split('_')[1].valueOf();

                if(id == firstTable.attr('id').split('_')[1].valueOf()){
                    firstIndex = i;
                } else if(id == lastTable.attr('id').split('_')[1].valueOf()) {
                    lastIndex = i;
                }
            });

            if(lastIndex < firstIndex) {
                var tmpIndex = lastIndex;
                lastIndex = firstIndex;
                firstIndex = tmpIndex;
            }

            $('table.annotation').map(function(i){
                if(i >= firstIndex && i <= lastIndex) {
                    $(this).addClass('t_selected');
                    var selectedId =  $(this).attr('id').split('_')[1].valueOf();
                    $('span#' + selectedId).addClass('selected');
                    selectedIds.push(selectedId);
                }
            })

            $('.annotation.t_selected .removeBtn').show();

        } else {
            //console.log('何も押されていません');
            // 一旦空にする
            selectedIds.splice(0, selectedIds.length);

            selectedIds.push(selectedId);

            $('span#' + selectedId).addClass('selected');

            $('#doc_area span').removeClass('selected');
            $('table.annotation').removeClass('t_selected');
            $('.removeBtn').hide();
            $('span#' + selectedId).addClass('selected');

            if(tagName == 'TD') {
                $(this).parent().parent().parent().addClass('t_selected');
            } else if(tagName == 'DIV') {
                $(this).parent().parent().parent().parent().addClass('t_selected');;
            }

            $('.annotation.t_selected .removeBtn').show();

        }

        deselect();
        return false;
    }


    /*
     * relation list上で選択
     */
    function selectRelationTable(e) {
        //console.log('relationテーブルが選択されました');

        var  selectedId;
        var tagName = $(this).get(0).tagName;

        if(tagName == 'TD') {
            selectedId =  $(this).parent().parent().parent().attr('id').split('_')[2].valueOf();
        } else if(tagName == 'DIV') {
            selectedId =  $(this).parent().parent().parent().parent().attr('id').split('_')[2].valueOf();
        }

        //console.log('selectedId:', selectedId);

        // 一時敵に隠蔽されたconnection以外
        if(!$('#relation_t_' + selectedId).hasClass('tmp_hide')) {

            if(e.ctrlKey) {

                //console.log("ctrlキーが押されています");

                if(tagName == 'TD') {
                    $(this).parent().parent().parent().addClass('t_selected');
                } else if(tagName == 'DIV') {
                    $(this).parent().parent().parent().parent().addClass('t_selected');
                }

                $('.relation.t_selected .removeBtn').show();

                //このIDのconnectionを取得
                var conns = getConnectionData();

                var conn;
                for(var i in conns) {
                    if(conns[i].id == selectedId) {
                        conn = conns[i];
                        break;
                    }
                }

                var source = $('#' + conn.subject);
                var target = $('#' + conn.object);
                var rgba = conn.paintStyle;
                var type = conn.type;
                var endpoints = conn.endpoints;

                var rgbas = rgba.split(',');
                rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',1)';

                var c = makeConnection(conn.subject, conn.object, type, rgba, selectedId, "selected", modanns);

                selectedConns.push(c);

                jsPlumb.deleteEndpoint(endpoints[0]);
                jsPlumb.deleteEndpoint(endpoints[1]);

            } else if(e.shiftKey && selectedConns.length == 1) {

                // ただし、一時非表示がある場合は、何もしない
                if(tmpHidedRelations == 0) {
                    e.preventDefault();

                    ///console.log("shiftキーが押されています");

                    // 一度選択をはずす
                    for(i in selectedConns) {
                        var sConn = selectedConns[i];
                        var source = sConn.source.attr('id');
                        var target = sConn.target.attr('id');

                        //console.log('source:',source);

                        var rgba = sConn.paintStyleInUse["strokeStyle"];
                        var endpoints = sConn.endpoints;
                        var connId = sConn.getParameter('connId');
                        var type = sConn.getParameter('type');

                        var c = makeConnection(source, target, type, rgba, connId, "unselected", modanns);

                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);

                    }


                    var firstConn = selectedConns.pop();
                    selectedConns.splice(0, selectedConns.length);

                    var firstId = firstConn.getParameter('connId');
                    var lastId = selectedId;

                    var firstIndex;
                    var lastIndex;

                    $('table.relation').map(function(i){
                        var id = $(this).attr('id').split('_')[2].valueOf();

                        if(id == firstId){
                            firstIndex = i;
                        } else if(id == lastId) {
                            lastIndex = i;
                        }
                    });

                    if(lastIndex < firstIndex) {
                        var tmpIndex = lastIndex;
                        lastIndex = firstIndex;
                        firstIndex = tmpIndex;
                    }


                    //connection dataを取得
                    var conns = getConnectionData();

                    // 選択されたconnectionのidを入れる
                    var selectedrelations = new Array();

                    $('table.relation').map(function(i){
                        if(i >= firstIndex && i <= lastIndex) {
                            $(this).addClass('t_selected');
                            var selectedId =  $(this).attr('id').split('_')[2].valueOf();
                            $('span#' + selectedId).addClass('selected');

                            // ここでいれる
                            for(var i in conns) {
                                if(conns[i].id == selectedId) {
                                    selectedrelations.push(conns[i]);
                                }
                            }
                        }
                    });

                    $('.relation.t_selected .removeBtn').show();

                    for(var k in selectedrelations) {
                        var conn = selectedrelations[k];
                       // var source = $('#' + conn.source_id);
                       // var target = $('#' + conn.target_id);
                        var rgba = conn.paintStyle;
                        var type = conn.type;
                        var endpoints = conn.endpoints;
                        var id = conn.id;

                        var rgbas = rgba.split(',');
                        rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',1)';

                        var c = makeConnection(conn.subject, conn.object, type, rgba, id, "selected", modanns);

                        selectedConns.push(c);

                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);
                    }


                }
            } else {


                //console.log("何も押されていません");
                //console.log('selectedConns.length:', selectedConns.length);

                for(var i = 0; i < selectedConns.length; i++) {
                    var sConn = selectedConns[i];
                    var source = sConn.source;
                    var target = sConn.target;
                    var rgba = sConn.paintStyleInUse["strokeStyle"];
                    var endpoints = sConn.endpoints;
                    var connId = sConn.getParameter('connId');
                    var type = sConn.getParameter('type');

                    var subject = source.attr('id');
                    var object = target.attr('id');

                    var rgbas = rgba.split(',');
                    rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',' + connOpacity + ')';


                    //var c = makeConnection(source, target, type, rgba, connId);
                    //var c = makeConnection(subject, object, type, rgba, connId, labelText, modId, "");
                    var c = makeConnection(subject, object, type, rgba, connId, "unselected", modanns);

                    jsPlumb.deleteEndpoint(endpoints[0]);
                    jsPlumb.deleteEndpoint(endpoints[1]);

                }

                // 一旦空にする
                selectedConns.splice(0, selectedConns.length);

                $('table.relation').removeClass('t_selected');
                $('table.relation .removeBtn').hide();

                if(tagName == 'TD') {
                    $(this).parent().parent().parent().addClass('t_selected');
                } else if(tagName == 'DIV') {
                    $(this).parent().parent().parent().parent().addClass('t_selected');
                }

                $('.relation.t_selected .removeBtn').show();

                //このIDのconnectionを取得
                var conns = getConnectionData();

                var conn;
                for(var i in conns) {
                    if(conns[i].id == selectedId) {
                        conn = conns[i];
                        break;
                    }
                }

                var source = $('#' + conn.subject);
                var target = $('#' + conn.object);
                var rgba = conn.paintStyle;
                var type = conn.type;
                var endpoints = conn.endpoints;

                var rgbas = rgba.split(',');
                rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',1)';

                var c = makeConnection(conn.subject, conn.object, type, rgba, selectedId, "selected", modanns);

                selectedConns.push(c);

                jsPlumb.deleteEndpoint(endpoints[0]);
                jsPlumb.deleteEndpoint(endpoints[1]);
            }
        }
        deselect();
    }

    /*
     *
     */
    function selectModificationTable(e) {
        //e.stopPropagation();

        //console.log('selectModificationTable');

        var  selectedId;
        var tagName = $(this).get(0).tagName;

        if(tagName == 'TD') {
            selectedId =  $(this).parent().parent().parent().attr('id').split('_')[2].valueOf();
        } else if(tagName == 'DIV') {
            selectedId =  $(this).parent().parent().parent().parent().attr('id').split('_')[2].valueOf();
        }

        //console.log('selectedId:', selectedId);
        //console.log('e.ctrlKey:', e.ctrlKey);


        /*
        if(mode == "edit") {

            if(e.ctrlKey) {
                //console.log('複数選択');


                selectedModificationIds.push(selectedId);

                $('div span#' + selectedId).addClass('mod_selected');

                if(tagName == 'TD') {
                    $(this).parent().parent().parent().addClass('t_selected');
                } else if(tagName == 'DIV') {
                    $(this).parent().parent().parent().parent().addClass('t_selected');;
                }

                $('.modification.t_selected .removeBtn').show();




            } else if(e.shiftKey && selectedModificationIds.length == 1) {


                e.preventDefault();

                console.log("shiftキーが押されています");

                var firstId = selectedModificationIds.pop();

                selectedModificationIds.splice(0, selectedModificationIds.length);

                var firstTable = $('#modification_t_' + firstId);

                var lastTable;

                if(tagName == 'TD') {
                    lastTable = $(this).parent().parent().parent().parent();
                } else if(tagName == 'DIV') {
                    lastTable = $(this).parent().parent().parent().parent();
                }

                var firstIndex;
                var lastIndex;

                $('table.modification').map(function(i){
                    var id = $(this).attr('id').split('_')[2].valueOf();

                    if(id == firstTable.attr('id').split('_')[2].valueOf()){
                        firstIndex = i;
                    } else if(id == lastTable.attr('id').split('_')[2].valueOf()) {
                        lastIndex = i;
                    }
                });

                if(lastIndex < firstIndex) {
                    var tmpIndex = lastIndex;
                    lastIndex = firstIndex;
                    firstIndex = tmpIndex;
                }

                $('table.modification').map(function(i){
                    if(i >= firstIndex && i <= lastIndex) {
                        $(this).addClass('t_selected');
                        var selectedId =  $(this).attr('id').split('_')[2].valueOf();

                        $('div span#' + selectedId).addClass('mod_selected');
                        selectedModificationIds.push(selectedId);
                    }
                })

                $('.modification.t_selected .removeBtn').show();


            } else {
                //console.log('何も押されていません');
                // 一旦空にする
                selectedModificationIds.splice(0, selectedModificationIds.length);


                // 一旦選択を解除
                var elem = $('.mod_selected').removeClass('mod_selected');

                // remove_btnを表示
                $('#modificationtable .removeBtn').hide();
                $('#modificationtable .t_selected').removeClass('t_selected');

                selectedModificationIds.push(selectedId);

                $('div span#' + selectedId).addClass('mod_selected').attr('id');

                if(tagName == 'TD') {
                    $(this).parent().parent().parent().addClass('t_selected');
                } else if(tagName == 'DIV') {
                    $(this).parent().parent().parent().parent().addClass('t_selected');;
                }

                $('.modification.t_selected .removeBtn').show();

            }

        } else if(mode == "relation") {
        */

            if(e.ctrlKey) {
                selectedModificationIds.push(selectedId);


                // instanceのmodificationを選択
                $('div span#' + selectedId).addClass('mod_selected');

                // relationのmodificationを選択
                var objectId;
                var i;
                for(i = 0; i < modanns.length; i++) {
                    var mod = modanns[i];
                    if(selectedId == mod["id"]) {
                        objectId = mod["object"];

                    }
                }

                //console.log('objectId:', objectId);
                // ここで該当するrelationをみつけて、書き直し

                var conns = getConnectionData();
                for(i = 0; i < conns.length; i++) {
                    var conn = conns[i];

                    var subject = conn["subject"];
                    var object = conn["object"];
                    var rgba = conn["paintStyle"];
                    var id = conn["id"];
                    var endpoints = conn["endpoints"];
                    var type = conn["type"];


                    if(id == objectId) {
                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);
                        var c = makeConnection(subject, object, type, rgba, id, "unselected", modanns);

                    }

                }
                addModtypeColor(modTypes);


                //$('div span#' + selectedId).addClass('mod_selected').attr('id');

                if(tagName == 'TD') {
                    $(this).parent().parent().parent().addClass('t_selected');
                } else if(tagName == 'DIV') {
                    $(this).parent().parent().parent().parent().addClass('t_selected');
                }

                $('.modification.t_selected .removeBtn').show();

            } else if(e.shiftKey && selectedModificationIds.length == 1) {
                e.preventDefault();

                //console.log("shiftキーが押されています");

                var firstId = selectedModificationIds.pop();

                selectedModificationIds.splice(0, selectedModificationIds.length);

                var firstTable = $('#modification_t_' + firstId);

                var lastTable;

                if(tagName == 'TD') {
                    lastTable = $(this).parent().parent().parent().parent();
                } else if(tagName == 'DIV') {
                    lastTable = $(this).parent().parent().parent().parent();
                }

                var firstIndex;
                var lastIndex;

                $('table.modification').map(function(i){
                    var id = $(this).attr('id').split('_')[2].valueOf();

                    if(id == firstTable.attr('id').split('_')[2].valueOf()){
                        firstIndex = i;
                    } else if(id == lastTable.attr('id').split('_')[2].valueOf()) {
                        lastIndex = i;
                    }
                });

                if(lastIndex < firstIndex) {
                    var tmpIndex = lastIndex;
                    lastIndex = firstIndex;
                    firstIndex = tmpIndex;
                }

                $('table.modification').map(function(i){
                    if(i >= firstIndex && i <= lastIndex) {
                        $(this).addClass('t_selected');
                        var selectedId =  $(this).attr('id').split('_')[2].valueOf();

                        // instanceのmodificationを選択
                        $('div span#' + selectedId).addClass('mod_selected');
                        selectedModificationIds.push(selectedId);
                    }
                })

                $('.modification.t_selected .removeBtn').show();



                // relationのmodificationを選択
                var objectIds = new Array();
                var i;
                var j;
                for(i = 0; i < modanns.length; i++) {
                    var mod = modanns[i];

                    for(j = 0; j < selectedModificationIds.length; j++) {

                        if(selectedModificationIds[j] == mod["id"]) {
                            objectIds.push(mod["object"]);

                        }
                    }

                }

                //console.log('objectId:', objectId);
                // ここで該当するrelationをみつけて、書き直し

                var conns = getConnectionData();
                for(i = 0; i < conns.length; i++) {
                    var conn = conns[i];

                    var subject = conn["subject"];
                    var object = conn["object"];
                    var rgba = conn["paintStyle"];
                    var id = conn["id"];
                    var endpoints = conn["endpoints"];
                    var type = conn["type"];

                    for(j = 0; j < objectIds.length; j++) {
                        if(id == objectIds[j]) {
                            jsPlumb.deleteEndpoint(endpoints[0]);
                            jsPlumb.deleteEndpoint(endpoints[1]);
                            var c = makeConnection(subject, object, type, rgba, id, "unselected", modanns);
                        }
                    }
                }
                addModtypeColor(modTypes);


            } else {
                // 一旦空にする
                selectedModificationIds.splice(0, selectedModificationIds.length);

                // 一旦選択を解除
                var elem = $('.mod_selected').removeClass('mod_selected');

                // remove_btnを表示
                $('#modificationtable .removeBtn').hide();
                $('#modificationtable .t_selected').removeClass('t_selected');


                selectedModificationIds.push(selectedId);


                // instanceのmodificationを選択状態
                $('div span#' + selectedId).addClass('mod_selected').attr('id');

                if(tagName == 'TD') {
                    $(this).parent().parent().parent().addClass('t_selected');
                } else if(tagName == 'DIV') {
                    $(this).parent().parent().parent().parent().addClass('t_selected');;
                }

                $('.modification.t_selected .removeBtn').show();



                // relationのmodificationを選択状態
                var objectId;
                var i;
                for(i = 0; i < modanns.length; i++) {
                    var mod = modanns[i];
                    if(selectedId == mod["id"]) {
                        objectId = mod["object"];

                    }
                }

                //console.log('objectId:', objectId);
                // ここで該当するrelationをみつけて、書き直し

                var conns = getConnectionData();
                for(i = 0; i < conns.length; i++) {
                    var conn = conns[i];

                    var subject = conn["subject"];
                    var object = conn["object"];
                    var rgba = conn["paintStyle"];
                    var id = conn["id"];
                    var endpoints = conn["endpoints"];
                    var type = conn["type"];


                    if(id == objectId) {
                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);
                        var c = makeConnection(subject, object, type, rgba, id, "unselected", modanns);

                    }

                }
                addModtypeColor(modTypes);


                //$('div span#' + selectedId).addClass('mod_selected').attr('id');

                if(tagName == 'TD') {
                    $(this).parent().parent().parent().addClass('t_selected');
                } else if(tagName == 'DIV') {
                    $(this).parent().parent().parent().parent().addClass('t_selected');
                }

                $('.modification.t_selected .removeBtn').show();
            }
        //}

        deselect();
        return false;
    }


    function selectInstanceTable() {
        var  selectedId;
        var tagName = $(this).get(0).tagName;

        if(tagName == 'TD') {
            selectedId =  $(this).parent().parent().parent().attr('id').split('_')[2].valueOf();
        } else if(tagName == 'DIV') {
            selectedId =  $(this).parent().parent().parent().parent().attr('id').split('_')[2].valueOf();
        }

        //console.log('selectedId:', selectedId);

        if(isCtrl) {
            //console.log('複数選択');

            selectedInstanceIds.push(selectedId);

            $('div#' + selectedId).css('border-color', '#000000').addClass('ins_selected').attr('id');

            if(tagName == 'TD') {
                $(this).parent().parent().parent().addClass('t_selected');
            } else if(tagName == 'DIV') {
                $(this).parent().parent().parent().parent().addClass('t_selected');
            }

            $('.instance.t_selected .removeBtn').show();

        } else if(isShift && selectedIds.length == 1) {

            e.preventDefault();

            //console.log("shiftキーが押されています");

            var firstId = selectedInstanceIds.pop();
            selectedInstanceIds.splice(0, selectedInstanceIds.length);

            var firstTable = $('#instance_t_' + firstId);

            var lastTable;

            if(tagName == 'TD') {
                lastTable = $(this).parent().parent().parent().parent();
            } else if(tagName == 'DIV') {
                lastTable = $(this).parent().parent().parent().parent();
            }

            var firstIndex;
            var lastIndex;

            $('table.instance').map(function(i){
                var id = $(this).attr('id').split('_')[2].valueOf();

                if(id == firstTable.attr('id').split('_')[2].valueOf()){
                    firstIndex = i;
                } else if(id == lastTable.attr('id').split('_')[2].valueOf()) {
                    lastIndex = i;
                }
            });

            if(lastIndex < firstIndex) {
                var tmpIndex = lastIndex;
                lastIndex = firstIndex;
                firstIndex = tmpIndex;
            }

            $('table.instance').map(function(i){
                if(i >= firstIndex && i <= lastIndex) {
                    $(this).addClass('t_selected');
                    var selectedId =  $(this).attr('id').split('_')[2].valueOf();

                    $('div#' + selectedId).css('border-color', '#000000').addClass('ins_selected').attr('id');
                    selectedInstanceIds.push(selectedId);
                }
            })

            $('.instance.t_selected .removeBtn').show();

        } else {
            //console.log('何も押されていません');
            // 一旦空にする
            selectedInstanceIds.splice(0, selectedInstanceIds.length);

            selectedInstanceIds.push(selectedId);

            // 一旦選択を解除
            var elem = $('.ins_selected').removeClass('ins_selected');
            addInstanceBorderColor(elem, spanTypes);
            // remove_btnを表示
            $('#insannstable .removeBtn').hide();
            $('#insannstable .t_selected').removeClass('t_selected');

            $('div#' + selectedId).css('border-color', '#000000').addClass('ins_selected').attr('id');

            if(tagName == 'TD') {
                $(this).parent().parent().parent().addClass('t_selected');
            } else if(tagName == 'DIV') {
                $(this).parent().parent().parent().parent().addClass('t_selected');;
            }

            $('.instance.t_selected .removeBtn').show();

        }

        deselect();
        return false;
    }


    /*
     * annotation list部分のeditable上でクリック
     */
    function focusEditTable(e) {
        var id =  $(this).parent().parent().parent().parent().attr('id').split('_')[1].valueOf();

        if(isCtrl) {

            selectedIds.push(id);

            $('span#' + id).addClass('selected');

            $(this).parent().parent().parent().parent().addClass('t_selected');
            $('.annotation.t_selected .removeBtn').show();
        } else if(isShift && selectedIds.length == 1) {

            //console.log("shiftキーが押されています");

            var firstId = selectedIds.pop();
            selectedIds.splice(0, selectedIds.length);

            var firstTable = $('#t_' + firstId);
            var lastTable = $('#t_' + id);

            var firstIndex;
            var lastIndex;

            $('table.annotation').map(function(i){
                var tableId = $(this).attr('id').split('_')[1].valueOf();

                if(tableId == firstId){
                    firstIndex = i;
                } else if(tableId == id) {
                    lastIndex = i;
                }
            });

            if(lastIndex < firstIndex) {
                var tmpIndex = lastIndex;
                lastIndex = firstIndex;
                firstIndex = tmpIndex;
            }

            $('table.annotation').map(function(i){
                if(i >= firstIndex && i <= lastIndex) {
                    $(this).addClass('t_selected');
                    var selectedId =  $(this).attr('id').split('_')[1].valueOf();
                    $('span#' + selectedId).addClass('selected');
                    selectedIds.push(selectedId);
                }
            })

            $('.annotation.t_selected .removeBtn').show();

        } else {

            // 一旦空にする
            selectedIds.splice(0, selectedIds.length);

            selectedIds.push(id);

            $('#doc_area span').removeClass('selected');
            $('table.annotation').removeClass('t_selected');
            $('table.newAnnotation').removeClass('t_selected');
            $('.removeBtn').hide();

            $('span#' + id).addClass('selected');

            $(this).parent().parent().parent().parent().addClass('t_selected');
            $('.annotation.t_selected .removeBtn').show();

        }
    }


    /*
     * loadアイコンクリックでロードウィンドウ表示
     */
    $('#load_btn').click(function() {
        $('#load_dialog').show();
    });


    /*
     * load submitボタンクリックでサーバーからデータをロード
     */
    $('#load_submit').click(function() {
        targetUrl = $('#load_url').val();
        $('#load_dialog').hide();
        loadAnnotation(targetUrl);
        return false;
    });


    /*
     * load キャンセル
     */
    $('#load_cancel').click(function() {
        $('#load_dialog').hide();
        return false;
    });

    /*
     * saveアイコンクリックでセーブウィンドウ表示
     */
    $("#save_btn").click(function(){
        $('#save_dialog').show();
        $('#save_url').val(targetUrl);
        return false;
    });


    jQuery.fn.center = function () {
        //position:absolute;を与えて、ウィンドウのサイズを取得し、topとleftの値を調整
        this.css("position","absolute");
        this.css("top", ( $(window).height() - this.height() ) / 2+$(window).scrollTop() + "px");
        this.css("left", ( $(window).width() - this.width() ) / 2+$(window).scrollLeft() + "px");
        return this;
    };


    /*
     * save submitボタンクリックでサーバーにデータをPOST
     */
    $('#save_submit').click(function() {
        $('#save_dialog').hide();
        $('#loading').center().show();
        var doc = $('#src_area').text();

        var post_catanns = spans

        var postData = {
            "text":doc,
            "catanns": post_catanns,
            "relanns": relations,
            "insanns": insanns,
            "modanns": modanns
        }

        var username = $('#username').val();
        var password = $('#password').val();

        $.ajax({
            type: "post",
            url: $('#save_url').val(),
            data: {annotations:JSON.stringify(postData)},
            crossDomain: true,
            xhrFields: {withCredentials: true},
            success: function(res){
                //console.log( "Data Saved: " + res );
                $('#loading').hide();
                $('#notice').html("annotation saved").fadeIn().fadeOut(5000, function() {
                    $(this).html('').removeAttr('style');
                    showSource();
                });
            },
            error: function(res, textStatus, errorThrown){
                //console.log("エラー:", res, ":", textStatus);
                $('#loading').hide();
                $('#save_dialog').hide();
                $('#notice').html("could not save").fadeIn().fadeOut(5000, function() {
                    $(this).html('').removeAttr('style');
                    showSource();
                });
            }
        });

        return false;
    });

    /*
     * saveキャンセル
     */
    $('#save_cancel').click(function() {
        $('#save_dialog').hide();
        return false;
    });

    /*
     * always_multiple_btnをクリック
     */
    $('#always_multiple_btn').live("click", function() {
        //console.log($(this).attr('src'));
        if($(this).attr('src') == 'images/always_multiple_on_btn.png') {
            $(this).attr("src", 'images/always_multiple_off_btn.png');
            $('#multiple_btn').prop('disabled', false);
            $('#multiple_btn').css('opacity', 1);
            isMultiple = false;
        } else {
            $(this).attr("src", 'images/always_multiple_on_btn.png');
            $('#multiple_btn').prop('disabled', true);
            $('#multiple_btn').css('opacity', 0.3);
            isMultiple = true;
        }
        return false;
    });

    /*
     * multiple_btnをクリック
     */
    $('#multiple_btn').click(function() {
        if(selectedIds.length == 1) {
            var id = selectedIds[0];

            var selectedAnno;
            for(var k in spans) {
                if(spans[k]['id'] == id) {
                    selectedAnno = spans[k];
                    break;
                }
            }


            //console.log('selectedAnno:', selectedAnno);
            var startPos = selectedAnno["span"]["begin"];
            var endPos = selectedAnno["span"]["end"];
            var category = selectedAnno["category"];

            var origElem = selectedAnno;

            // 新規作成された要素
            var newElem = new Array();
            // 不完全要素
            var partialElem = new Array();

            var now = (new Date()).getTime();
            var maxId = getSpanMaxId();

            var ary = findSameString(startPos, endPos, category, spans);

            for(var i = 0; i < ary.length; i++) {

               var isAcross = false;

               // ここでjsonのbeginとendが他のjsonにまたがっていないかチェックする
               for(j in spans) {
                   if(ary[i]['span']['begin'] > spans[j]['span']['begin'] && ary[i]['span']['begin'] < spans[j]['span']['end'] && ary[i]['span']['end'] > spans[j]['span']['end'] ) {
                       // 開始位置がまたがっているので、不完全要素
                       isAcross = true;
                       ary[i]['span']['begin'] = validateStartDelimiter(spans[j]['span']['end']);
                       partialElem.push(ary[i]);
                       break;
                   } else if(ary[i]['span']['begin'] < spans[j]['span']['begin'] && ary[i]['span']['end'] > spans[j]['span']['begin'] && ary[i]['span']['end'] < spans[j]['span']['end']) {
                       // 終了位置がまたがっているので、不完全要素
                       ary[i]['end'] = validateEndDelimiter(spans[j]['begin']);
                       partialElem.push(ary[i]);
                       isAcross = true;
                       break;
                   }

               }

               if(!isAcross) {
                   maxId = maxId + 1;
                   ary[i]['id'] = "T" + maxId;

                   ary[i]['created_at'] = now;
                   spans.push(ary[i]);
                   newElem.push(ary[i]);
               }

            }

           sortSpans(spans);

           for(var i in spans) {

               if(spans[i]['new']) {
                   // 選択状態にする
                   selectedIds.push(spans[i]['id']);
                   //selectedElements.push(annoJson[i]);
               }

               for(var j in partialElem) {
                   if(spans[i]['new'] && spans[i]['span'].begin == partialElem[j]['span'].begin && spans[i]['span'].end == partialElem[j]['span'].end && spans[i].category == partialElem[j].category) {
                       //console.log("不完全要素は：", i);
                       // 選択状態にする
                       partialIds.push(i);
                   }
               }

               // new プロパティを削除
               delete spans[i]['new']
           }

           renderSpans(spans);
           addCategoryColor(spanTypes);
           //setCurrentStorage(spans);

           saveCurrent("catanns");
        }
        return false;
    });


    /*
     * notice_ok_btnをクリック
     */
    $('#notice_ok_btn').live('click', function() {
        $('#notice').empty();
        showSource();

        if($('.partial').hasClass('partialSelected')) {
            $('.partial').addClass('selected');
        }

        if($('.t_partial').hasClass('t_partialSelected')) {
            $('.t_partial').addClass('t_selected');
        }

        $('.partial').removeClass('partialSelected').removeClass('partial');
        $('.t_partial').removeClass('t_partialSelected').removeClass('t_partial');
    });


    /*
     * 一時的に非表示状態にしたコネクションの再表示
     */
    function showHideAllConnections(flag, relType) {

        if(flag == "show") {
            // hidden connection draw
            var start = tmpHidedRelations.length - 1;
            for(var i = start;  i >= 0;  i--) {
                var connObj = tmpHidedRelations[i];
                var s_id = connObj['subject'];
                var t_id = connObj['object'];
                var rgba = connObj['paintStyle'];
                var connId = connObj['id'];
                var type = connObj['type'];

                //console.log('s_id:', s_id);
                if(relType == "all") {
                    $('.rel_hide').attr('checked','checked');
                    makeConnection(s_id, t_id, type, rgba, connId, "unselected", modanns);
                    tmpHidedRelations.splice(i, 1);
                    $('.tmp_hide').removeClass('tmp_hide');

                } else {
                    if(type == relType) {
                        makeConnection(s_id, t_id, type, rgba, connId, "unselected", modanns);
                        tmpHidedRelations.splice(i, 1);
                        $('.tmp_hide.t_' + type).removeClass('tmp_hide');
                    }
                }
            }


            selectedConns.splice(0, selectedConns.length);

            jsPlumb.repaintEverything();

        } else {

        }
    }

    /*
     * relationモードボタンクリック
     */
    $('#relation_btn').click(function() {

        if(sourceElem != null) {
            //console.log('sourceElemがあります');
            sourceElem = null;
            $('.source_selected').removeClass('source_selected');

            // 空にする
            selectedConns.splice(0, selectedConns.length);
        }

        // テーブルを選択解除にする
        $('.relation').removeClass('t_selected');
        $('.annotation').removeClass('t_selected');
        $('.removeBtn').hide();

        if($(this).attr('src') == 'images/relation_off_btn.png') {
            $('#always_multiple_btn').prop('disabled', true);

            // relationモード
            mode = "relation";
            // connectionにclickイベントをバインド
            // bindConnectionEvent();

            changeMode(mode);
        } else {
            // viewモード
            mode = 'view';


            // span編集モード

            // connectionのclickイベントをunbind
            //unbindConnectionEvent();

            //console.log('選択された接続数:',selectedConns.length);
            //もし選択せれた接続があれば、線を細く書き直す
            for(var i in selectedConns) {
                var sConn = selectedConns[i];
                var source = sConn.source;
                var target = sConn.target;
                var rgba = sConn.paintStyleInUse["strokeStyle"];
                var endpoints = sConn.endpoints;
                var connId = sConn.getParameter('connId');
                var type = sConn.getParameter('type');

                jsPlumb.deleteEndpoint(endpoints[0]);
                jsPlumb.deleteEndpoint(endpoints[1]);

                makeConnection(source, target, type, rgba, connId, "unselected", modanns);
            }

            changeMode(mode);
        }

    });


    function unselectRelation() {
        $('table.relation').removeClass('t_selected');
        $('table.relation .removeBtn').hide();

        for(var i in selectedConns) {
            var sConn = selectedConns[i];
            var source = sConn.source;
            var target = sConn.target;
            var rgba = sConn.paintStyleInUse["strokeStyle"];
            var endpoints = sConn.endpoints;
            var connId = sConn.getParameter('connId');
            var type = sConn.getParameter('type');

            /*
            var labelText = "";
            var modId = ""
            for(var i = 0; i < sConn.overlays.length; i++) {
                var overlay = sConn.overlays[i];
                console.log('label:', overlay["type"]);

                if(overlay["type"] == "Label") {
                    console.log(overlay.getLabel());
                    labelText = overlay.getLabel();
                    modId = overlay["id"];
                }
            }
            */

            //var c = makeConnection(source, target, type, rgba, connId);
            var subject = source.attr('id');
            var object = target.attr('id');

            //var c = makeConnection(subject, object, type, rgba, connId, "unselected", labelText, modId, "");

            var c = makeConnection(subject, object, type, rgba, connId, "unselected", modanns);

            jsPlumb.deleteEndpoint(endpoints[0]);
            jsPlumb.deleteEndpoint(endpoints[1]);
        }
        // 空にする
        selectedConns.splice(0, selectedConns.length);
    }


    function changeMode(mode) {
        sourceElem = null;
        targetElem = null;

        if(mode == 'view') {

            $('#doc_area').removeAttr('style');
            $('#ins_area').removeAttr('style');
            $('#rel_base_area').removeAttr('style');

            var bg_color = $('#doc_area').css('backgroundColor');

            if(bg_color.substr(0,4) == 'rgba') {
                var rgba = bg_color.replace('rgba', '').replace('(', '').replace(')', '');
                var rgbas = rgba.split(',');
                var rgb = 'rgb(' + rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ')' ;
                $('#doc_area').css('backgroundColor', rgb);
            }


            $('#edit_btn').attr("src", 'images/edit_off_btn.png');
            $('#relation_btn').attr("src", 'images/relation_off_btn.png');

            // span編集モードの選択を削除
            selectedIds.splice(0, selectedIds.length);
            $('#doc_area span').removeClass('selected').removeClass('partialSelected');
            $('table.annotation').removeClass('t_selected').removeClass('t_partialSelected');
            $('.removeBtn').hide();

            // マウスアップで、spanの操作をアンバインド
            $(document).die('click', '*:not(#notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, ' +
                'table.annotation tr td div, ' +
                'table.newAnnotation tr td div, .editable,  #removeBtn, .category_apply_btn, .relation_apply_btn, img, form, ' +
                '#load_dialog, #load_btn, :button, :text, :input');
            $('#doc_area').die('mouseup', doMouseup);

            // 選択解除イベントをアンバインド
            $("*:not(#joint_area, #notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, " +
                "table.annotation tr td div, " +
                "table.newAnnotation tr td div, .editable,  #removeBtn, td.category_apply_btn, td.relation_apply_btn, img, form, " +
                "#load_dialog, #load_btn, :button, :text, :input, table.instance, table.instance tr td, table.instance tr td div, " +
                "#ins_area div span.modification)").die("click", cancelSelect);



            $('.editable').die('focus', focusEditTable);

            // sourceElem とtargetElemの選択解除をアンバインド
            $("*:not(#doc_area span, #ins_area div)").die("click", cancelSelectSourceAndTargetElement);

            $('.editable').die('focus', focusEditTable);

            $('#doc_area span').die('click', clickSpan);

            $('div.instance').die('click', selectInstance);


            if(selectedModificationIds.length > 0) {
                selectedModificationIds.splice(0, selectedModificationIds.length);
                unselectModification();
                addModtypeColor(modTypes);
            }

            duplicateDocArea();

            // relationの選択を解除
            unselectRelation();

            unsetCancelSelect();


            // インスタンス上のmodificationを選択不可にする
            $('span.instance_modification').die('click', selectInsModification);


        } else if(mode == 'edit') {

            $('#doc_area').css('z-index', 1);
            $('#ins_area').css('z-index', 2);
            $('#rel_base_area').css('z-index', -1);


            var bg_color = $('#doc_area').css('backgroundColor');

            if(bg_color.substr(0, 4) != 'rgba') {
                var rgb = bg_color.replace('rgb', '').replace('(', '').replace(')', '');
                var rgba = 'rgba(' + rgb + ',0.5)';
                //console.log(bg_color);
                //console.log(rgba);
            }

            $('#doc_area').css('backgroundColor', rgba);

            $('#edit_btn').attr("src", 'images/edit_on_btn.png');
            $('#relation_btn').attr("src", 'images/relation_off_btn.png');


            // spanの選択を削除
            selectedIds.splice(0, selectedIds.length);
            $('#doc_area span').removeClass('source_selected');
            $('table.annotation').removeClass('t_selected').removeClass('t_partialSelected');
            $('.removeBtn').hide();

            $('#clone_area div').remove();

            setCancelSelect();

            //console.log(mode);

            // relationの選択を解除
            unselectRelation();

            // modificationの選択を削除
            if(selectedModificationIds.length > 0) {
                selectedModificationIds.splice(0, selectedModificationIds.length);
                unselectModification();
                addModtypeColor(modTypes);
            }

            $('#doc_area span').die('click', clickSpan);
            $('#doc_area span').live('click', clickSpan);

            $('div.instance').die('click', selectInstance);
            $('div.instance').live('click', selectInstance);

            //テキスト部分でドラッグ後マウスアップ
            $('#doc_area').die('mouseup',  doMouseup);
            $('#doc_area').live('mouseup',  doMouseup);


            // sourceElem とtargetElemの選択解除をアンバインド
            $("*:not(#doc_area span, #ins_area div)").die("click", cancelSelectSourceAndTargetElement);

            // インスタンス上のmodificationを選択可能にする
            $('span.instance_modification').die('click', selectInsModification);
            $('span.instance_modification').live('click', selectInsModification);

        } else if(mode == 'relation') {

            $('#doc_area').removeAttr('style');
            $('#ins_area').removeAttr('style');
            $('#rel_base_area').removeAttr('style');


            var bg_color = $('#doc_area').css('backgroundColor');

            if(bg_color.substr(0, 4) != 'rgba') {
                var rgb = bg_color.replace('rgb', '').replace('(', '').replace(')', '');
                var rgba = 'rgba(' + rgb + ',0.5)';
                //console.log(bg_color);
                //console.log(rgba);
            }

            $('#edit_btn').attr("src", 'images/edit_off_btn.png');
            $('#relation_btn').attr("src", 'images/relation_on_btn.png');

            // span編集モードの選択を削除
            selectedIds.splice(0, selectedIds.length);
            $('#doc_area span').removeClass('selected').removeClass('partialSelected');
            $('table.annotation').removeClass('t_selected').removeClass('t_partialSelected');
            $('.removeBtn').hide();

            // マウスアップで、spanの操作を解除
            $(document).die('click', '*:not(#notice_ok_btn,  #doc_area span, table.annotation, table.annotation tr td, ' +
                'table.annotation tr td div, ' +
                'table.newAnnotation tr td div, .editable,  #removeBtn, .category_apply_btn, .relation_apply_btn, img, form, #load_dialog, #load_btn, :button, :text, :input')
            $('#doc_area').die('mouseup', doMouseup);

            setCancelSelect();

            $('table.relation tr td, table.relation tr td div').die('click', selectRelationTable);
            $('table.relation tr td, table.relation tr td div').live('click', selectRelationTable);

            $('table.modification tr td, table.modification tr td div').die('click', selectModificationTable);
            $('table.modification tr td, table.modification tr td div').live('click', selectModificationTable);


            $('.editable').die('focus', focusEditTable);

            $('table.instance tr td, table.instance tr td div').die('click', selectInstanceTable);

            // sourceElem とtargetElemの選択解除をアンバインド
            //$("*:not(#doc_area span, #ins_area div)").die("click", cancelSelectSourceAndTargetElement);
           // $("*:not(#doc_area span, #ins_area div)").live("click", cancelSelectSourceAndTargetElement);

            $('#doc_area span').die('click', clickSpan);
            $('#doc_area span').live('click', clickSpan);

            $('div.instance').die('click', selectInstance);
            $('div.instance').live('click', selectInstance);

            // インスタンス上のmodificationを選択不可にする
            $('span.instance_modification').die('click', selectInsModification);

            duplicateDocArea();

        }

        sessionStorage.setItem('mode', mode);

    }


    function duplicateDocArea(){
        $('#clone_area .clone_div').remove();

        var cloneArray = new Array();

        for(var i in spans) {
            var anno = spans[i];
            var span = $('#' + anno['id']);

            obj = new Object();
            obj["id"] = "clone_" + anno["id"];
            obj["left"] = span.get(0).offsetLeft;
            obj["top"] = span.get(0).offsetTop;
            obj["width"] = span.outerWidth();
            obj["height"] = span.outerHeight();
            obj["title"] = '[' + anno["id"] + '] ' + anno["category"];
            cloneArray.push(obj);
        }

        // 大きいDIVが下にくるようにソート
        sortCloneByWidth(cloneArray);

        for(var i in cloneArray) {

            var obj = cloneArray[i];

            var div = '<div id="' + obj['id'] + '" class="clone_div" ' +
                'style="position:absolute;left:' + obj['left'] + 'px;top:' + obj['top']  + 'px;' +
                'width:' + obj["width"] +'px;height:' + obj["height"] +'px;background-color:red; opacity:0" class="clone_div" title="' + obj['title'] + '"></div>';

            $('#clone_area').append(div);
        }

        // instanceのclone

        var insdivs = $('#ins_area div');
        insdivs.map(function() {
            //console.log($(this));
            var clone_id = 'clone_' + $(this).attr('id');
            var clone_ins = $(this).clone(true).attr('id', clone_id).css('backgroundColor', 'blue').css('opacity', "0").empty();
            $('#clone_area').append(clone_ins);

        })

        $('.clone_div').click(clickSpan);
    }


    /*
     * 複製を幅でソート
     */
    function sortCloneByWidth(ary) {
        function compare(a, b) {
            return(b['width'] - a['width']);
        }
        ary.sort(compare);
    }

    /*
     * 16進数からrgbaへの色変換
     */
    function colorTrans(color) {
        var c = color.slice(1);
        var r = c.substr(0,2);
        var g = c.substr(2,2);
        var b = c.substr(4,2);
         //console.log("color:", r,":", g, ":", b);
        r = parseInt(r, 16);
        g = parseInt(g, 16);
        b = parseInt(b, 16);

        return 'rgba(' + r + ',' +  g + ',' + b + ', ' + connOpacity + ')';
    }


    /*
     * subject, objectが削除された場合の
     * コネクションの再描画
     */
    function reMakeConnectionOnDelete() {
        jsPlumb.reset();

        for(var i in relations) {
            var conn = relations[i];
            var sId = conn['subject'];
            var tId = conn['object'];
            var connId = conn['id'];
            var type = conn['type'];

            var color = relationTypes[conn['type']]["color"];
            var rgba = colorTrans(color);

            makeConnection(sId, tId, type, rgba, connId, "unselected", modanns);
        }


        var conns = getConnectionData();

        for(var i in conns) {
            var conn = conns[i];
            var source = $('#' + conn.subject);
            var target = $('#' + conn.object);
            var rgba = conn.paintStyle;
            var type = conn.type;
            var endpoints = conn.endpoints;
            var id = conn.id;

            for(var j in tmpHidedRelations) {
                var hideConn = tmpHidedRelations[j];

                if(id == hideConn['id']) {
                    jsPlumb.deleteEndpoint(endpoints[0]);
                    jsPlumb.deleteEndpoint(endpoints[1]);
                }
            }
        }
    }


    /*
     * spanやinstanceの位置が変更になったときの
     * コネクションの再描画
     */
    function reMakeConnection() {
        var conns = getConnectionData();

        for(var i in conns) {
            addDistanceToRelation(conns[i]);
        }
        sortConnByDistance(conns);

        for(var i in conns) {
            var conn = conns[i];
            var rgba = conn.paintStyle;
            var endpoints = conn.endpoints;

            jsPlumb.deleteEndpoint(endpoints[0]);
            jsPlumb.deleteEndpoint(endpoints[1]);

            var rgbas = rgba.split(',');

            var isDrawSelected = false;

            for(var j in selectedConns) {
                if(selectedConns[j].getParameter("connId") == conn.id) {
                    rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',1)';
                    makeConnection(conn.subject, conn.object, conn.type, rgba, conn.id, "selected", modanns);
                    isDrawSelected = true;
                    break;
                }
            }

            // 選択状態で書かれていなければ、書きます
            if(!isDrawSelected) {
                rgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',' + connOpacity +  ')';
                makeConnection(conn.subject, conn.object, conn.type, rgba, conn.id, "unselected", modanns);
            }
        }
    }


    /*
     * コネクションの作成
     * source, target, relation, rgba, connId, flag
     */
    function makeConnection(sourceId, targetId, type, rgba, connId, flag, modanns) {
        var sourceElem = $('#' + sourceId);
        var targetElem = $('#' + targetId);

        var sourceX = sourceElem.get(0).offsetLeft - doc_area_left;
        var sourceY = sourceElem.get(0).offsetTop - doc_area_top;

        var targetX = targetElem.get(0).offsetLeft - doc_area_left;
        var targetY = targetElem.get(0).offsetTop - doc_area_top;

        var sourceWidth = sourceElem.outerWidth();
        var targetWidth = targetElem.outerWidth();

        var curviness = 16;//べじぇ曲線の曲率
        var sourceAnchors;
        var targetAnchors;

        // 中央の値
        var source_center;
        var target_center;

        if(sourceId.substr(0,1) == "T") {
            source_center = sourceX + sourceWidth/2;
        } else {
            source_center = (sourceX + 10/2); // 10はinstanceの幅
        }

        if(targetId.substr(0,1) == "T") {
            target_center = targetX + targetWidth/2;
        } else {
            target_center = (targetX + 10/2); // 10はinstanceの幅
        }

        if((sourceId.substr(0,1) == "T") && (targetId.substr(0,1) == "T") ) {
            sourceAnchors = ["BottomCenter"];
            targetAnchors = ["BottomCenter"];
        } else {
            sourceAnchors = ["TopCenter"];
            targetAnchors = ["TopCenter"];
        }

        // curvinessの掛け率
        var xrate = 0.6;
        var yrate = 0.05;
        // curvinessのオフセット
        var c_offset = 20;

        xdiff = Math.abs(source_center - target_center);
        ydiff = Math.abs(sourceY - targetY);
        curviness = xdiff * xrate + ydiff * yrate + c_offset;
        curviness /= 2.4;

        if(sourceId == targetId) {
            //console.log('自己参照');
            curviness = 30;
            sourceAnchors = [0.5, 1, -1, 1, -5, 0];
            targetAnchors = [0.5, 1, 1, 1, 5, 0];
        }
   
        jsPlumb.makeSource(sourceElem, {
            anchor:sourceAnchors,
            paintStyle:{ fillStyle:rgba, radius:3 }
        });

        jsPlumb.makeTarget(targetElem, {
            anchor:targetAnchors,
            paintStyle:{ fillStyle:rgba, radius:3 }
        });

        var lineWidth = 1;
        if(flag == "selected") {
            lineWidth = 2;
        }

        var overlays = new Array();

        // arrowの適用
        var arrowArray = new Array();
        arrowArray.push('Arrow');
        var arrow = {width:12, length:12, location:1};
        arrowArray.push(arrow);

        overlays.push(arrowArray);

        // for modifications on relation
        // var i;
        // var cnt = 0;

        // if(modanns != undefined) {

        //     for(i = 0; i < modanns.length; i++) {
        //         var mod = modanns[i];
        //         var objectId = mod["object"];
        //         var modId = mod["id"];
        //         var modType = mod["type"];

        //         //console.log(modId, ':--objectId--:', objectId, ":", connId);

        //         if(objectId == connId) {
        //             // このリレーションにmodificationがつく
        //             //console.log('このリレーションにmodificationがつく');
        //             console.log(objectId, connId);

        //             var labelArray = new Array();
        //             labelArray.push('Label');

        //             var events = {
        //                 click:function(labelOverlay, originalEvent) {
        //                     if(mode == "relation") {
        //                         // originalEvent.stopPropagation();

        //                         originalEvent.stopImmediatePropagation();

        //                         if(isCtrl) {

        //                         } else {
        //                             // 一旦、modificationの選択を削除
        //                             unselectModification();
        //                         }

        //                         //labelOverlay["cssClass"] = "mod_selected";
        //                         //jsPlumb.repaintEverything();

        //                         selectedModificationIds.push(labelOverlay["id"]);

        //                         var conns = getConnectionData();
        //                         for(var i = 0; i < conns.length; i++) {
        //                             if(conns[i]["id"] == connId) {
        //                                 //console.log("これ", conns[i]);

        //                                 var endpoints = conns[i]["endpoints"];

        //                                 // 一旦削除して、再描画
        //                                 jsPlumb.deleteEndpoint(endpoints[0]);
        //                                 jsPlumb.deleteEndpoint(endpoints[1]);
        //                                 var c = makeConnection(sourceElem.attr('id'), targetElem.attr('id'), type, rgba, connId, "unselected", modanns);

        //                             }
        //                         }

        //                         addModtypeColor(modTypes);
        //                         // 該当するテーブルを選択状態にする

        //                         $('#modification_t_' + modId).addClass('t_selected');
        //                         $('.modification.t_selected .removeBtn').show();

        //                     }

        //                 }
        //             };


        //             var cssClass = "";


        //             for(var j in selectedModificationIds) {
        //                 if(modId == selectedModificationIds[j]) {
        //                     cssClass = "mod_selected";
        //                     break;
        //                 }
        //             }


        //             if(modType == "Negation") {

        //                 var obj = {label:'<span class="modification mod_Negation" >X</span>', id:modId,  cssClass:cssClass, location:(cnt * 0.1)+0.5, events:events};
        //                 labelArray.push(obj);

        //             } else if(modType == "Speculation") {

        //                 var obj = {label:'<span class="modification mod_Speculation" >?</span>', id:modId,  cssClass:cssClass, location:(cnt * 0.1)+0.5, events:events};
        //                 labelArray.push(obj);
        //             }

        //             overlays.push(labelArray);

        //             cnt++;

        //         }

        //     }
        // }

        //console.log('labelText:', labelText);
        var rgbas = rgba.split(',');
        var hoverRgba = rgbas[0] + ',' + rgbas[1] + ',' + rgbas[2] + ',1)';

        var conn = jsPlumb.connect({
            source:sourceElem,
            target:targetElem,
            connector:[ "Bezier", { curviness:curviness }],
            detachable:false,
            // paintStyle:{ lineWidth:10, strokeStyle:'rgba(0, 0, 200, 0.5)'},
            paintStyle:{ lineWidth:lineWidth, strokeStyle:rgba },
            hoverPaintStyle:{lineWidth:2,strokeStyle: hoverRgba},
            overlays:overlays,
            tooltip:'[' + connId + '] ' + type,
            cssClass:type,

            parameters:{connId:connId, type:type}
        });

        jsPlumb.unmakeSource(conn.sourceId).unmakeTarget(conn.targetId);

        // 選択
        conn.bind("click", function(conn, e) {
            //console.log('リレーションモード:', isRelationMode);
            //console.log('e:', e);

            if($(e.currentTarget) == "path") {
                //console.log('click path');
            }
            //console.log('e.currentTarget:', $(e.currentTarget));

            if(mode == "relation") {

                // modificationの選択をはずす

                $('table.modification .removeBtn').hide();
                $('table.modification').removeClass('t_selected');
                selectedModificationIds.splice(0, selectedModificationIds.length);
                addModtypeColor(modTypes);

                // 一旦削除して、新たに太い線をかく
                e.stopPropagation();

                if(e.ctrlKey) {
                    var source = conn.source;
                    var target = conn.target;
                    var rgba = conn.paintStyleInUse["strokeStyle"];
                    var endpoints = conn.endpoints;
                    var connId = conn.getParameter('connId');
                    var type = conn.getParameter('type');

                    selectedConns.push(conn);

                    // テーブルを選択状態にする
                    $('#relation_t_' + connId).addClass('t_selected');
                    // remove_btnを表示
                    $('.relation.t_selected .removeBtn').show();
                    //console.log('削除ボタン:', $('.relation.t_selected .removeBtn'));

                } else {
                    //console.log('選択されました');

                    // 空にする
                    selectedConns.splice(0, selectedConns.length);

                    var source = conn.source;
                    var target = conn.target;
                    var rgba = conn.paintStyleInUse["strokeStyle"];
                    var endpoints = conn.endpoints;
                    var connId = conn.getParameter('connId');
                    var type = conn.getParameter('type');

                    var subject = source.attr('id');
                    var object = target.attr('id');


                    selectedConns.push(conn);

                    // テーブルを選択状態にする
                    $('.relation').removeClass('t_selected');
                    $('.relation .removeBtn').hide();

                    $('#relation_t_' + connId).addClass('t_selected');
                    // remove_btnを表示

                    $('.relation.t_selected .removeBtn').show();

                }

                reMakeConnection();

            }

            return false;

        });

        return conn;

      // }
    }


    function renderInstances(insanns) {
        $('#ins_area').empty();

        var numInsPerObj = {};
        for(var i in insanns) {
            var ins = insanns[i];
            var objectId = ins["object"];

            if (numInsPerObj[objectId]) {
                numInsPerObj[objectId]++;
            } else {
                numInsPerObj[objectId] = 1;
            }

            var object = $('#' + objectId);
            // console.log(objectId);

            var objectTop = object.get(0).offsetTop;
            var objectLeft = object.get(0).offsetLeft;
            var objectWidth = object.outerWidth();
            var objectCenter = objectLeft + objectWidth/2;

            // offsetを左右に振り分ける
            var offset;
            if(numInsPerObj[objectId] % 2 == 0) {
                offset = -(insMargin + insWidth + insBorder) * Math.floor(numInsPerObj[objectId]/2);
            } else {
                offset = (insMargin + insWidth + insBorder) * Math.floor(numInsPerObj[objectId]/2);
            }

            // divを書く位置
            var posX = objectCenter - insWidth/2 - insBorder + offset;
            var posY = objectTop - insHeight - insBorder * 2;

            // 元のcategory annotationのcategory
            var cate = object.attr('class').split(' ')[0];

            // 枠の色、インスタンスの元のcategory annotationの色
            var borderColor = spanTypes[cate]["color"];

            // ここでspanの上部にdivを描く?
            var div = '<div id="' + ins["id"] +'" class="instance ' + ins["type"] + ' ' + cate + '" title="[' + ins["id"] + '] ' + ins["type"] + '" style="position:absolute;left:' + posX + 'px; top:' + posY + 'px; width:' + insWidth +'px; height:' + insHeight + 'px; border:' + insBorder + 'px solid ' + borderColor + '" ></div>';
            // var div = '<div id="' + ins["id"] +'" class="instance ' + ins["type"] + ' ' + cate + '" title="[' + ins["id"] + '] ' + ins["type"] + '" style="position:absolute;left:' + objectLeft + 'px; top:' + objectTop + 'px; width:' + objectWidth +'px; height:' + insHeight + 'px; border:' + insBorder + 'px solid ' + borderColor + '" ></div>';

            //var div = '<div id="' + ins["id"] +'" class="instance ' + ins["type"] + ' ' + cate + '" style="position:absolute;left:' + posX + 'px; top:' + posY + 'px; width:' + w +'px; height:' + h + 'px;" ></div>';
            $('#ins_area').append(div);

            // 選択マークをつける
            for(var m in selectedInstanceIds) {
                $('#ins_area div#' + selectedInstanceIds[m]).css('border-color', '#000000').addClass('ins_selected');
            }
        }
    }


    function renderModifications(modanns) {
        $('div.instance span.modification').remove();

        for(var i = 0; i < modanns.length; i++) {
            var mod = modanns[i];
            var type = mod["type"];
            var object = mod["object"];
            var modId = mod["id"];

            //console.log('id:', id);
            //console.log('object:', object);

            if(object.substr(0,1) == "R") {
                // relationがmodificationされている

                var conns = getConnectionData();

                for(var j in conns) {
                    var conn = conns[j];
                    var connSubject = conn["subject"];
                    var connObject = conn["object"];
                    var rgba = conn["paintStyle"];
                    var connId = conn["id"];
                    var connType = conn["type"];
                    var endpoints = conn["endpoints"];

                    if(object == connId)  {
                        // 一旦消して、新たに書く
                        //console.log('書きます', connId);
                        jsPlumb.deleteEndpoint(endpoints[0]);
                        jsPlumb.deleteEndpoint(endpoints[1]);
                        var c = makeConnection(connSubject, connObject, connType, rgba, connId, "unselected", modanns);
                    }
                }
            } else {
                // instanceがmodificationされている
                for(var j in insanns) {
                    var ins = insanns[j];
                    if(ins["id"] == object) {
                        if(type == "Negation") {
                            $('#' + object).append('<span class="modification mod_' + type + ' instance_modification" id="' + modId + '">X</span>');
                        } else if(type == "Speculation") {
                            $('#' + object).append('<span class="modification mod_' + type + ' instance_modification" id="' + modId + '">?</span>');
                        }

                    }
                }

            }

        }

    }


    function unselectModification() {


        //for(var i in selectedModificationIds) {

            // 選択されているmodificationは
           // var selectedModId = selectedModificationIds[i];
           // console.log('selectedModId:', selectedModId);


            var conns = getConnectionData();

            for(var j in conns) {
                var conn = conns[j];

                //var labelText = "";
                //var modId = "";
                //for(var i = 0; i < conn.overlays.length; i++) {
                   // var overlay = conn.overlays[i];
                    //console.log('label:', overlay["type"]);

                    //if(overlay["type"] == "Label") {
                       // console.log(overlay.getLabel());
                        //labelText = overlay.getLabel();
                        //modId = overlay["id"];

                        //if(selectedModId == modId) {

                            var connId = conn["id"];
                            var subject = conn["subject"];
                            var object = conn["object"]
                            var rgba = conn["paintStyle"];
                            var endpoints = conn["endpoints"];
                            var type = conn['type'];

                            //console.log(connId, "を書き直します");

                            jsPlumb.deleteEndpoint(endpoints[0]);
                            jsPlumb.deleteEndpoint(endpoints[1]);

                            //var c = makeConnection(subject, object, type, rgba, connId, "unselected", labelText, modId, "");
                            var c = makeConnection(subject, object, type, rgba, connId, "unselected", modanns);
                        //}
                    //}
               // }

            }

       // }



        // modificationの選択をはずす
        $('span.mod_selected').removeClass('mod_selected');
        $('table.modification .removeBtn').hide();
        $('table.modification').removeClass('t_selected');


        selectedModificationIds.splice(0, selectedModificationIds.length);

    }

    function changeConnectionOpacity(opacity) {
        var conns = getConnectionData();

        for(var j in conns) {
            var conn = conns[j];
            //var source = $('#' + conn.subject);
            //var target = $('#' + conn.object);
            var rgba = conn.paintStyle;

            var as = rgba.split(",");
            //console.log(conn["id"], ", as[3]:", as[3]);
            //var a = as[3].replace(")", "");

            rgba = as[0] + "," + as[1] + "," + as[2] + "," + opacity + ")";

           // console.log('rgba:',a);
            //rgba(0,51,255, 0.5)

            var type = conn.type;
            var endpoints = conn.endpoints;
            var id = conn.id;

            var labelText = "";
            var modId = "";
            for(var i = 0; i < conn.overlays.length; i++) {
                var overlay = conn.overlays[i];
                //console.log('label:', overlay["type"]);

                if(overlay["type"] == "Label") {
                    //console.log(overlay.getLabel());
                    labelText = overlay.getLabel();
                    modId = overlay["id"];
                }
            }

            jsPlumb.deleteEndpoint(endpoints[0]);
            jsPlumb.deleteEndpoint(endpoints[1]);

            //makeConnection(source, target, type, rgba, id);

            //makeConnection(conn.subject, conn.object, type, rgba, id, "unselected", labelText, modId, "");

            makeConnection(conn.subject, conn.object, type, rgba, id, "unselected", modanns);
        }
    }

    // instanceがあるか
    function hasInstance(cate_id) {

        var has = false;

        for(var i in insanns) {
            var ins = insanns[i];

            if(ins["object"] == cate_id) {
                has = true;
                break;
            }

        }

        return has;

    }

    $(window).resize(function(){
      redraw();
    });

    function redraw() {
        renderInstances(insanns);
        addInstypeColor(instanceTypes);
        reMakeConnection();
        mode = sessionStorage.getItem('mode');
        changeMode(mode);
    }

    $(window).bind('beforeunload', function(){
        return "Before You leave, please be sure you've saved all the changes.\nOtherwise, you may lose your changes.";
    });

});
