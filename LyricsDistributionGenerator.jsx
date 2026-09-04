#target aftereffects
#targetengine "LyricsDistributionGenerator"

/*
 * Lyrics Distribution Generator 3.4.0
 * A single-file Adobe After Effects ExtendScript tool.
 * Generated from a clean design; no external libraries or plug-ins required.
 */
(function LyricsDistributionGenerator(thisObj) {
    var APP_NAME = "Lyrics Distribution Generator";
    var VERSION = "3.4.0";
    var PRESET_SECTION = "LyricsDistributionGenerator.CharacterPresets";
    var CONFIG_SECTION = "LyricsDistributionGenerator.DefaultConfig";
    var CONFIG_VERSION = "6";
    var fontCache = null;
    var AUTO = "AUTO_";
    var NONE_STYLE_LABEL = "[无]";

    var state = {
        assFile: null,
        audioFile: null,
        bgFile: null,
        spectrumFile: null,
        coverLogoFile: null,
        ass: null,
        characters: [],
        selectedCharacter: -1,
        annotationFile: null,
        annotationCues: [],
        annotationSelected: -1,
        audioPreviewComp: null,
        recordedCutTimes: [],
        presetMap: null,
        factoryConfig: null,
        ui: {}
    };

    var CONFIG_TEXT_KEYS=["compName","width","height","fps","bgColor","portraitHeight","nameFont","nameSize","nameSecondSize","nameStrokeColor","nameStrokeWidth","nameShadowColor","nameShadowOpacity","nameShadowDirection","nameShadowDistance","nameShadowSoftness","layoutX","layoutY","charSize","charGap","maxLayoutWidth","inactiveOpacity","activeScale","transition","inactiveTintAmount","inactiveLightFactor","inactiveGrayAmount","bannerGlow","bannerGlowRadius","bannerBottomGlowRadius","bannerActiveGlow","bannerActiveGlowRadius","bannerHeight","bannerColor","bannerText","bannerFont","bannerSize","bannerTextColor","multiColorA","multiColorB","allColorA","allColorB","lyricX","maxLyricWidth","mainFont","mainSize","mainMinSize","mainY","mainColor","subFont","subSize","subMinSize","subY","subColor","lyricIn","lyricOut","lyricShadowColor","lyricShadowOpacity","lyricShadowDirection","lyricShadowDistance","lyricShadowSoftness","spectrumPath","spectrumCompName","spectrumAudioLayer","spectrumX","spectrumY","spectrumScale","spectrumWidth","spectrumStartFreq","spectrumEndFreq","spectrumBands","spectrumMaxHeight","spectrumDurationMs","spectrumThickness","spectrumSoftness","spectrumColor","spectrumMinimax","spectrumContrast","coverDuration","coverLogoPath","coverLogoWidth","songTitle","songTitleFont","songTitleSize","songTitleColor","songTitleGlow","songTitleGlowRadius","coverInfo","coverInfoFont","coverInfoSize","coverInfoColor","coverTitleY","coverInfoY"];
    var CONFIG_CHECK_KEYS=["showNames","nameShadowEnabled","inactiveTint","bannerEnabled","lyricFollowSinger","lyricStroke","lyricShadowEnabled","spectrumEnabled","spectrumMirror","spectrumAfterIntro","coverEnabled","introEnabled"];
    var CONFIG_DROP_KEYS=["layoutMode","multiColorMode","allColorMode","lyricAnimation","spectrumMode","spectrumSide","coverTitleMode"];

    // ---------- Generic helpers ----------
    function trim(s) { return String(s === undefined || s === null ? "" : s).replace(/^\s+|\s+$/g, ""); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function num(text, fallback, lo, hi) {
        var v = parseFloat(text);
        if (isNaN(v)) { v = fallback; }
        if (lo !== undefined) { v = Math.max(lo, v); }
        if (hi !== undefined) { v = Math.min(hi, v); }
        return v;
    }
    function intNum(text, fallback, lo, hi) { return Math.round(num(text, fallback, lo, hi)); }
    function positionValue(text,total,fallbackRatio){var s=trim(text),v;if(/%$/.test(s)){v=parseFloat(s);return isNaN(v)?total*fallbackRatio:total*v/100;}return num(s,total*fallbackRatio,-30000,30000);}
    function calculateBannerHeight(text,fontSize,padding){return trim(text)?Math.max(8,fontSize+padding*2):Math.max(6,padding*1.5);}
    function pad(n, len) { var s = String(n); while (s.length < len) { s = "0" + s; } return s; }
    function safeName(s) {
        var v = trim(s).replace(/[\\\/:*?"<>|]/g, "_");
        return v.length ? v : "Character";
    }
    function fileExists(file) { return file && file.exists; }
    function uniquePush(arr, value) {
        var i;
        for (i = 0; i < arr.length; i++) { if (arr[i] === value) { return; } }
        arr.push(value);
    }
    function parseHexColor(text, fallback) {
        var s = trim(text).replace(/^#/, "");
        if (/^[0-9a-fA-F]{3}$/.test(s)) { s = s.charAt(0)+s.charAt(0)+s.charAt(1)+s.charAt(1)+s.charAt(2)+s.charAt(2); }
        if (!/^[0-9a-fA-F]{6}$/.test(s)) { return fallback || [1, 1, 1]; }
        return [parseInt(s.substr(0,2),16)/255, parseInt(s.substr(2,2),16)/255, parseInt(s.substr(4,2),16)/255];
    }
    function colorToHex(rgb) {
        function h(v) { return pad(Math.round(clamp(v,0,1)*255).toString(16).toUpperCase(), 2); }
        return "#" + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
    }
    function chooseColor(edit) {
        if (!$.colorPicker) { alert("当前 After Effects 不支持系统选色器，请直接输入 #RRGGBB。", APP_NAME); return; }
        var initial = parseInt(trim(edit.text).replace(/^#/, ""), 16);
        if (isNaN(initial)) { initial = 0xFFFFFF; }
        var picked = $.colorPicker(initial);
        if (picked >= 0) { edit.text = "#" + pad(picked.toString(16).toUpperCase(), 6).substr(-6); }
    }
    function availableFonts() {
        if(fontCache){return fontCache;}
        fontCache=[];
        try{
            if(app.fonts&&app.fonts.allFonts){
                var groups=app.fonts.allFonts,i,j,f,label,seen={};
                for(i=0;i<groups.length;i++){
                    for(j=0;j<groups[i].length;j++){
                        f=groups[i][j];if(!f.postScriptName||seen[f.postScriptName]){continue;}seen[f.postScriptName]=true;
                        label=(f.nativeFullName||f.fullName||((f.familyName||"")+" "+(f.styleName||"")))+"  ["+f.postScriptName+"]";
                        fontCache.push({label:label,search:label.toLowerCase(),postScriptName:f.postScriptName,familyName:f.familyName||f.postScriptName,styleName:f.styleName||"Regular"});
                    }
                }
            }
        }catch(e){}
        return fontCache;
    }
    function chooseFont(edit) {
        var fonts=availableFonts();
        if(!fonts.length){alert("当前 AE 版本无法枚举字体。字体列表需要 AE 24.6 或更高版本；仍可直接输入 PostScript Name。",APP_NAME);return;}
        var dlg=new Window("dialog","选择字体");dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.preferredSize=[620,650];
        var search=dlg.add("edittext",undefined,"");search.helpTip="输入字体名或 PostScript Name 搜索";
        var list=dlg.add("listbox",undefined,[],{multiselect:false});list.preferredSize=[600,440];
        var preview=dlg.add("statictext",undefined,"Aa 标题预览 かな カナ 123");preview.preferredSize=[600,52];preview.justify="center";
        var buttons=dlg.add("group");buttons.alignment="right";var ok=buttons.add("button",undefined,"确定",{name:"ok"});buttons.add("button",undefined,"取消",{name:"cancel"});
        function updatePreview(){var item=list.selection,f;if(!item){return;}f=fonts[item.fontIndex];try{preview.graphics.font=ScriptUI.newFont(f.familyName,f.styleName,30);}catch(e){try{preview.graphics.font=ScriptUI.newFont(f.postScriptName,"Regular",30);}catch(e2){}}preview.text="Aa 标题预览 かな カナ 123";dlg.layout.layout(true);}
        function refresh(){var q=trim(search.text).toLowerCase(),i,item,selectedPS=edit.text;list.removeAll();for(i=0;i<fonts.length;i++){if(!q||fonts[i].search.indexOf(q)>=0){item=list.add("item",fonts[i].label);item.fontPS=fonts[i].postScriptName;item.fontIndex=i;if(fonts[i].postScriptName===selectedPS){list.selection=item;}}}updatePreview();}
        search.onChanging=refresh;list.onChange=updatePreview;list.onDoubleClick=function(){if(list.selection){dlg.close(1);}};refresh();search.active=true;
        if(dlg.show()===1&&list.selection){edit.text=list.selection.fontPS;}
    }
    function readTextFile(file) {
        if (!file || !file.exists) { throw new Error("文件不存在。"); }
        file.encoding = "UTF-8";
        if (!file.open("r")) { throw new Error("无法打开文件：" + file.fsName); }
        var text = file.read();
        file.close();
        if (text.length && text.charCodeAt(0) === 0xFEFF) { text = text.substr(1); }
        return text;
    }
    function setDropSelection(drop, label, fallbackIndex) {
        var i;
        for (i = 0; i < drop.items.length; i++) {
            if (drop.items[i].text === label) { drop.selection = i; return; }
        }
        if (drop.items.length) { drop.selection = clamp(fallbackIndex || 0, 0, drop.items.length - 1); }
    }
    function selectedText(drop) { return drop && drop.selection ? drop.selection.text : ""; }
    function configKeys(){return CONFIG_TEXT_KEYS.concat(CONFIG_CHECK_KEYS).concat(CONFIG_DROP_KEYS);}
    function snapshotUIConfig(){var u=state.ui,out={},i,k;for(i=0;i<CONFIG_TEXT_KEYS.length;i++){k=CONFIG_TEXT_KEYS[i];if(u[k]){out[k]=String(u[k].text);}}for(i=0;i<CONFIG_CHECK_KEYS.length;i++){k=CONFIG_CHECK_KEYS[i];if(u[k]){out[k]=u[k].value?"1":"0";}}for(i=0;i<CONFIG_DROP_KEYS.length;i++){k=CONFIG_DROP_KEYS[i];if(u[k]){out[k]=selectedText(u[k]);}}return out;}
    function applyUIConfig(cfg){var u=state.ui,i,k;for(i=0;i<CONFIG_TEXT_KEYS.length;i++){k=CONFIG_TEXT_KEYS[i];if(u[k]&&cfg[k]!==undefined){u[k].text=cfg[k];}}for(i=0;i<CONFIG_CHECK_KEYS.length;i++){k=CONFIG_CHECK_KEYS[i];if(u[k]&&cfg[k]!==undefined){u[k].value=cfg[k]==="1";}}for(i=0;i<CONFIG_DROP_KEYS.length;i++){k=CONFIG_DROP_KEYS[i];if(u[k]&&cfg[k]!==undefined){setDropSelection(u[k],cfg[k],0);}}}
    function loadDefaultConfig(){var cfg={},keys=configKeys(),i,k,oldVersion;if(!app.settings.haveSetting(CONFIG_SECTION,"saved")||app.settings.getSetting(CONFIG_SECTION,"saved")!=="1"){return false;}try{oldVersion=app.settings.haveSetting(CONFIG_SECTION,"version")?app.settings.getSetting(CONFIG_SECTION,"version"):"0";for(i=0;i<keys.length;i++){k=keys[i];if(app.settings.haveSetting(CONFIG_SECTION,k)){cfg[k]=decodeURIComponent(app.settings.getSetting(CONFIG_SECTION,k));}}if(oldVersion!==CONFIG_VERSION){cfg.portraitHeight="540";cfg.inactiveLightFactor="58";cfg.inactiveGrayAmount="65";cfg.spectrumMode="内置频谱";cfg.spectrumEnabled="1";cfg.spectrumY="1050";cfg.spectrumMaxHeight="220";cfg.spectrumSide="仅向上";cfg.spectrumAfterIntro="1";cfg.spectrumColor="#000000";cfg.coverTitleMode="文字标题";cfg.coverTitleY="75%";}applyUIConfig(cfg);return true;}catch(e){alert("读取默认配置失败：\r"+e.toString(),APP_NAME);return false;}}
    function saveDefaultConfig(){var cfg=snapshotUIConfig(),keys=configKeys(),i,k;try{for(i=0;i<keys.length;i++){k=keys[i];if(cfg[k]!==undefined){app.settings.saveSetting(CONFIG_SECTION,k,encodeURIComponent(cfg[k]));}}app.settings.saveSetting(CONFIG_SECTION,"version",CONFIG_VERSION);app.settings.saveSetting(CONFIG_SECTION,"saved","1");alert("当前生成配置已保存为默认值。\r下次打开脚本时会自动载入。",APP_NAME);}catch(e){alert("保存默认配置失败：\r"+e.toString(),APP_NAME);}}
    function restoreFactoryConfig(){if(state.factoryConfig){applyUIConfig(state.factoryConfig);}try{app.settings.saveSetting(CONFIG_SECTION,"saved","0");}catch(e){}alert("已恢复出厂默认配置。",APP_NAME);}
    function addLabeledEdit(parent, label, value, chars) {
        var g = parent.add("group");
        g.orientation = "row"; g.alignChildren = ["left", "center"];
        var st = g.add("statictext", undefined, label); st.preferredSize.width = 100;
        var e = g.add("edittext", undefined, String(value)); e.characters = chars || 12;
        return e;
    }
    function addFileRow(parent, label, onChoose) {
        var g = parent.add("group"); g.orientation = "row"; g.alignChildren = ["left", "center"];
        var st = g.add("statictext", undefined, label); st.preferredSize.width = 72;
        var e = g.add("edittext", undefined, ""); e.characters = 38; e.enabled = false;
        var b = g.add("button", undefined, "选择"); b.onClick = onChoose;
        return e;
    }
    function browseFile(prompt, filter) {
        return File.openDialog(prompt, filter, false);
    }

    // ---------- ASS parser ----------
    function assTimeToSeconds(s) {
        var m = trim(s).match(/^(\d+):(\d{1,2}):(\d{1,2})(?:[\.,](\d+))?$/);
        if (!m) { return NaN; }
        var fraction = m[4] ? parseFloat("0." + m[4]) : 0;
        return parseInt(m[1],10)*3600 + parseInt(m[2],10)*60 + parseInt(m[3],10) + fraction;
    }
    function splitAssFields(payload, expectedFields) {
        var out = [], start = 0, i, commas = 0;
        for (i = 0; i < payload.length && commas < expectedFields - 1; i++) {
            if (payload.charAt(i) === ",") { out.push(payload.substring(start, i)); start = i + 1; commas++; }
        }
        out.push(payload.substring(start));
        while (out.length < expectedFields) { out.push(""); }
        return out;
    }
    function cleanAssText(s) {
        return String(s).replace(/\\N/g, "\r").replace(/\\n/g, "\r").replace(/\\h/g, " ").replace(/\{[^}]*\}/g, "");
    }
    function groupFromEffect(effect){var m=trim(effect).match(/(?:^|;)LDG_GROUP=([^;]+)/i),v;if(!m){return "";}v=trim(m[1]);try{return decodeURIComponent(v);}catch(e){return v;}}
    function splitSingers(actor) {
        var raw = trim(actor), result = [], bits, i, name;
        if (!raw) { return result; }
        bits = raw.split("+");
        for (i = 0; i < bits.length; i++) {
            name = trim(bits[i]);
            if (name) { uniquePush(result, name); }
        }
        return result;
    }
    function parseASS(text) {
        var lines = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        var inEvents = false, format = null, events = [], styles = [], actorIds = [];
        var i, line, colon, key, payload, fields, map, j, ev, singers, singer;
        for (i = 0; i < lines.length; i++) {
            line = trim(lines[i]);
            if (!line || line.charAt(0) === ";") { continue; }
            if (/^\[.*\]$/.test(line)) { inEvents = /^\[events\]$/i.test(line); continue; }
            if (!inEvents) { continue; }
            colon = line.indexOf(":");
            if (colon < 0) { continue; }
            key = trim(line.substring(0, colon)).toLowerCase();
            payload = line.substring(colon + 1);
            if (key === "format") {
                format = payload.split(",");
                for (j = 0; j < format.length; j++) { format[j] = trim(format[j]).toLowerCase(); }
            } else if (key === "dialogue") {
                if (!format || !format.length) { format = ["layer","start","end","style","name","marginl","marginr","marginv","effect","text"]; }
                fields = splitAssFields(payload, format.length); map = {};
                for (j = 0; j < format.length; j++) { map[format[j]] = fields[j]; }
                ev = {
                    start: assTimeToSeconds(map.start),
                    end: assTimeToSeconds(map.end),
                    style: trim(map.style),
                    actor: trim(map.name !== undefined ? map.name : map.actor),
                    text: cleanAssText(map.text || ""),
                    group: groupFromEffect(map.effect || ""),
                    line: i + 1
                };
                if (isNaN(ev.start) || isNaN(ev.end) || ev.end <= ev.start) { continue; }
                ev.singers = splitSingers(ev.actor);
                events.push(ev);
                if (ev.style) { uniquePush(styles, ev.style); }
                for (j = 0; j < ev.singers.length; j++) {
                    singer = ev.singers[j];
                    if (singer.toUpperCase() !== "ALL" && singer.toUpperCase() !== "NONE") { uniquePush(actorIds, singer); }
                }
            }
        }
        events.sort(function(a,b) { return a.start - b.start || a.end - b.end || a.line - b.line; });
        return { events: events, styles: styles, actorIds: actorIds };
    }
    function parseSRT(text) {
        var blocks=String(text).replace(/^\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").split(/\n{2,}/),out=[],i,lines,j,m,content;
        for(i=0;i<blocks.length;i++){lines=blocks[i].split("\n");for(j=0;j<lines.length;j++){m=lines[j].match(/(\d+):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{3})/);if(m){content=lines.slice(j+1);out.push({start:(+m[1])*3600+(+m[2])*60+(+m[3])+(+m[4])/1000,end:(+m[5])*3600+(+m[6])*60+(+m[7])+(+m[8])/1000,main:content.length?content[0]:"",sub:content.length>1?content.slice(1).join("\r"):"",actor:"NONE"});break;}}}
        return out;
    }
    function parseLRC(text) {
        var lines=String(text).replace(/^\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n"),out=[],i,re,m,value,times,j;
        for(i=0;i<lines.length;i++){re=/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g;times=[];while((m=re.exec(lines[i]))!==null){times.push((+m[1])*60+(+m[2])+(m[3]?parseFloat("0."+m[3]):0));}value=trim(lines[i].replace(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g,""));for(j=0;j<times.length;j++){out.push({start:times[j],end:0,main:value,sub:"",actor:"NONE"});}}
        out.sort(function(a,b){return a.start-b.start;});for(i=0;i<out.length;i++){out[i].end=i<out.length-1?out[i+1].start:out[i].start+4;}
        return out;
    }
    function secondsLabel(v){var m=Math.floor(v/60),s=v-m*60;return pad(m,2)+":"+(s<10?"0":"")+s.toFixed(2);}
    function editableTimeLabel(v){var h=Math.floor(v/3600),m=Math.floor((v-h*3600)/60),s=v-h*3600-m*60;return pad(h,2)+":"+pad(m,2)+":"+(s<10?"0":"")+s.toFixed(2);}
    function parseEditableTime(text){var s=trim(text),m,v;if(/^\d+(?:\.\d+)?$/.test(s)){return parseFloat(s);}m=s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:[.,]\d+)?)$/);if(!m){return NaN;}v=(m[1]?parseInt(m[1],10)*3600:0)+parseInt(m[2],10)*60+parseFloat(String(m[3]).replace(",","."));return v;}
    function roleIdsFromText(text){var bits=String(text).split(/[,，;；]+/),out=[],i,v;for(i=0;i<bits.length;i++){v=trim(bits[i]);if(v&&v.toUpperCase()!=="ALL"&&v.toUpperCase()!=="NONE"){uniquePush(out,v);}}return out;}
    function currentCharacterIds(){var out=[],i;for(i=0;i<state.characters.length;i++){out.push(state.characters[i].id);}return out;}
    function annotationSaveCurrent(showError){var u=state.ui,i=state.annotationSelected,start,end,c,tagged;if(i<0||i>=state.annotationCues.length||!u.annotationActor){return true;}c=state.annotationCues[i];c.main=u.annotationMain.text;c.sub=u.annotationSub.text;c.actor=trim(u.annotationActor.text)||"NONE";c.group=trim(u.annotationGroup.text);tagged=taggedActorsFromText(c.main+"\r"+c.sub);if(tagged){c.actor=tagged;u.annotationActor.text=tagged;syncAnnotationChecks(tagged);}start=parseEditableTime(u.annotationStart.text);end=parseEditableTime(u.annotationEnd.text);if(isNaN(start)||isNaN(end)||start<0||end<=start){if(showError){alert("时间格式无效，结束时间必须晚于开始时间。\r可输入 00:01:23.45、01:23.45 或秒数。",APP_NAME);}return false;}c.start=start;c.end=end;return true;}
    function loadAnnotationCue(index){var u=state.ui,c;state.annotationSelected=index;if(index<0||index>=state.annotationCues.length){u.annotationStart.text="";u.annotationEnd.text="";u.annotationMain.text="";u.annotationSub.text="";u.annotationActor.text="NONE";u.annotationGroup.text="";syncAnnotationChecks("NONE");return;}c=state.annotationCues[index];u.annotationStart.text=editableTimeLabel(c.start);u.annotationEnd.text=editableTimeLabel(c.end);u.annotationMain.text=c.main||"";u.annotationSub.text=c.sub||"";u.annotationActor.text=c.actor||"NONE";u.annotationGroup.text=c.group||"";syncAnnotationChecks(u.annotationActor.text);}
    function refreshAnnotationList(selectIndex){var u=state.ui,i,c,group;if(!u.annotationList){return;}u.annotationList.removeAll();for(i=0;i<state.annotationCues.length;i++){c=state.annotationCues[i];group=c.group?" {"+c.group+"}":"";u.annotationList.add("item",secondsLabel(c.start)+"–"+secondsLabel(c.end)+group+"  ["+c.actor+"]  "+(c.main||c.sub));}if(state.annotationCues.length){selectIndex=clamp(selectIndex===undefined?0:selectIndex,0,state.annotationCues.length-1);u.annotationList.selection=selectIndex;loadAnnotationCue(selectIndex);}else{loadAnnotationCue(-1);}}
    function annotationActorFromChecks(){var checks=state.ui.annotationChecks||[],out=[],i;for(i=0;i<checks.length;i++){if(checks[i].value){out.push(checks[i]._actorId);}}return out.length?out.join("+"):"NONE";}
    function syncAnnotationChecks(actor){var checks=state.ui.annotationChecks||[],parts=splitSingers(actor),all=trim(actor).toUpperCase()==="ALL",i,j,found;for(i=0;i<checks.length;i++){found=all;for(j=0;!found&&j<parts.length;j++){if(parts[j]===checks[i]._actorId){found=true;}}checks[i].value=found;}}
    function annotationCheckHandler(){state.ui.annotationActor.text=annotationActorFromChecks();}
    function setAnnotationActor(actor){state.ui.annotationActor.text=actor;syncAnnotationChecks(actor);}
    function syncProjectRolesUI(){var u=state.ui,ids=currentCharacterIds();if(u.annotationRoleSummary){u.annotationRoleSummary.text=ids.length?ids.join(", "):"请先在“角色”页创建或添加角色";}if(u.annotationChecksPanel){refreshActorChecks();}}
    function refreshActorChecks(){var u=state.ui,ids=currentCharacterIds(),panel=u.annotationChecksPanel,i,col,box;while(panel.children.length){panel.remove(panel.children[0]);}u.annotationChecks=[];var columns=[];columns[0]=panel.add("group");columns[0].orientation="column";columns[0].alignChildren="left";columns[1]=panel.add("group");columns[1].orientation="column";columns[1].alignChildren="left";for(i=0;i<ids.length;i++){col=columns[i%2];box=col.add("checkbox",undefined,ids[i]);box._actorId=ids[i];box.onClick=annotationCheckHandler;u.annotationChecks.push(box);}syncAnnotationChecks(u.annotationActor?u.annotationActor.text:"NONE");panel.layout.layout(true);}
    function addAnnotationCue(){annotationSaveCurrent(false);var last=state.annotationCues.length?state.annotationCues[state.annotationCues.length-1]:null,start=last?last.end:0,cue={start:start,end:start+4,main:"新字幕",sub:"",actor:"NONE",group:"",mainStyle:selectedText(state.ui.mainStyle)||"JP",subStyle:selectedText(state.ui.subStyle)||"CN"},i,index=0;state.annotationCues.push(cue);state.annotationCues.sort(function(a,b){return a.start-b.start;});for(i=0;i<state.annotationCues.length;i++){if(state.annotationCues[i]===cue){index=i;break;}}refreshAnnotationList(index);}
    function deleteAnnotationCue(){var i=state.annotationSelected;if(i<0||i>=state.annotationCues.length){return;}state.annotationSelected=-1;state.annotationCues.splice(i,1);refreshAnnotationList(Math.min(i,state.annotationCues.length-1));}
    function nextLineGroupId(){var used={},i,g,n=1;for(i=0;i<state.annotationCues.length;i++){g=trim(state.annotationCues[i].group||"");if(g){used[g]=true;}}while(used["G"+n]){n++;}return "G"+n;}
    function startNewLineGroup(){var i=state.annotationSelected;if(i<0){return;}annotationSaveCurrent(false);state.annotationCues[i].group=nextLineGroupId();state.ui.annotationGroup.text=state.annotationCues[i].group;refreshAnnotationList(i);}
    function groupWithPrevious(){var i=state.annotationSelected,g;if(i<=0){alert("当前字幕前面没有可合并的字幕。",APP_NAME);return;}annotationSaveCurrent(false);g=trim(state.annotationCues[i-1].group||"");if(!g){g=nextLineGroupId();state.annotationCues[i-1].group=g;}state.annotationCues[i].group=g;state.ui.annotationGroup.text=g;refreshAnnotationList(i);}
    function findProjectComp(name){var i,item;if(!app.project){return null;}for(i=1;i<=app.project.numItems;i++){item=app.project.item(i);if(item instanceof CompItem&&item.name===name){return item;}}return null;}
    function previewCurrentAnnotation(){var i=state.annotationSelected,c,comp,layer,item,j;if(i<0||i>=state.annotationCues.length){alert("请先选择一条字幕。",APP_NAME);return;}if(!annotationSaveCurrent(true)){return;}if(!fileExists(state.audioFile)){alert("请先在“项目”页选择音乐文件。",APP_NAME);return;}c=state.annotationCues[i];ensureProject();comp=state.audioPreviewComp;if(!comp||!comp.isValid){comp=findProjectComp(AUTO+"SUBTITLE_AUDIO_PREVIEW");}if(!comp){item=importFootage(state.audioFile,null);comp=app.project.items.addComp(AUTO+"SUBTITLE_AUDIO_PREVIEW",1280,240,1,Math.max(item.duration,c.end+1),30);layer=comp.layers.add(item);layer.name=AUTO+"AUDIO";var textLayer=comp.layers.addText(c.main||c.sub);textLayer.name=AUTO+"PREVIEW_TEXT";setTextLayer(textLayer,c.main||c.sub,{font:"ArialMT",size:38,color:[1,1,1]});setLayerPosition(textLayer,[640,120]);}else{try{layer=comp.layer(AUTO+"AUDIO");item=importFootage(state.audioFile,null);if(layer){layer.replaceSource(item,false);}else{layer=comp.layers.add(item);layer.name=AUTO+"AUDIO";}}catch(e){}}state.audioPreviewComp=comp;comp.workAreaStart=c.start;comp.workAreaDuration=c.end-c.start;comp.time=c.start;try{var previewText=comp.layer(AUTO+"PREVIEW_TEXT"),doc=previewText.property("ADBE Text Properties").property("ADBE Text Document").value;doc.text=c.main||c.sub;previewText.property("ADBE Text Properties").property("ADBE Text Document").setValue(doc);}catch(textError){}comp.openInViewer();alert("已把 AE 工作区设为当前字幕区间。\r可按空格或数字键盘 0 预听，并拖动时间指针确定切换时间。",APP_NAME);}
    function activeCompTime(){try{var item=app.project.activeItem;if(item instanceof CompItem){return item.time;}}catch(e){}return null;}
    function recordCurrentCutTime(){var now=activeCompTime(),i;if(now===null){alert("请先打开预听合成并把时间指针停在切换点。",APP_NAME);return;}for(i=0;i<state.recordedCutTimes.length;i++){if(Math.abs(state.recordedCutTimes[i]-now)<0.001){return;}}state.recordedCutTimes.push(now);state.recordedCutTimes.sort(function(a,b){return a-b;});alert("已记录切换时间："+editableTimeLabel(now)+"\r当前共记录 "+state.recordedCutTimes.length+" 个时间点。",APP_NAME);}
    function splitCurrentAnnotation(){var index=state.annotationSelected,c,text,dlg,list,timeText,buttons,result,selections=[],positions=[],times=[],i,item,raw,p,t,group,segments=[],start,created=[],subCue=null,prefill=[];if(index<0||index>=state.annotationCues.length){alert("请先选择一条字幕。",APP_NAME);return;}if(!annotationSaveCurrent(true)){return;}c=state.annotationCues[index];text=String(c.main||"");if(text.length<2){alert("当前主歌词不足两个字符，无法切分。",APP_NAME);return;}for(i=0;i<state.recordedCutTimes.length;i++){if(state.recordedCutTimes[i]>c.start&&state.recordedCutTimes[i]<c.end){prefill.push(editableTimeLabel(state.recordedCutTimes[i]));}}dlg=new Window("dialog","按字符和时间切分字幕");dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.preferredSize=[700,560];dlg.add("statictext",undefined,"选择一个或多个字符边界；时间数量必须与边界数量一致。拆分后各段会自动归入同一行组。",{multiline:true});list=dlg.add("listbox",undefined,[],{multiselect:true});list.preferredSize=[670,330];for(i=1;i<text.length;i++){item=list.add("item",i+"  |  "+text.substring(Math.max(0,i-8),i)+"  ▌  "+text.substring(i,Math.min(text.length,i+8)));item.splitPos=i;}var timeG=dlg.add("group");timeG.add("statictext",undefined,"切换时间");timeText=timeG.add("edittext",undefined,prefill.join(", "));timeText.characters=42;timeText.helpTip="多个时间用逗号分隔，可输入秒数或 00:01:23.45";var currentBtn=timeG.add("button",undefined,"追加 AE 当前时间");currentBtn.onClick=function(){var now=activeCompTime();if(now===null){alert("请先打开预听合成并把时间指针停在切换点。",APP_NAME);return;}timeText.text+=(trim(timeText.text)?", ":"")+editableTimeLabel(now);};buttons=dlg.add("group");buttons.alignment="right";buttons.add("button",undefined,"取消",{name:"cancel"});buttons.add("button",undefined,"确认切分",{name:"ok"});if(dlg.show()!==1){return;}if(!list.selection){alert("没有选择字符边界。",APP_NAME);return;}selections=list.selection instanceof Array?list.selection:[list.selection];for(i=0;i<selections.length;i++){positions.push(selections[i].splitPos);}positions.sort(function(a,b){return a-b;});raw=trim(timeText.text).split(/[，,;；]+/);for(i=0;i<raw.length;i++){if(trim(raw[i])){t=parseEditableTime(trim(raw[i]));if(!isNaN(t)){times.push(t);}}}times.sort(function(a,b){return a-b;});if(times.length!==positions.length){alert("切换时间数量必须与所选字符边界数量一致。",APP_NAME);return;}for(i=0;i<times.length;i++){if(times[i]<=c.start||times[i]>=c.end||(i>0&&times[i]<=times[i-1])){alert("每个切换时间必须位于当前字幕区间内，并按先后顺序排列。",APP_NAME);return;}}group=nextLineGroupId();start=0;for(i=0;i<=positions.length;i++){p=i<positions.length?positions[i]:text.length;segments.push(text.substring(start,p));start=p;}for(i=0;i<segments.length;i++){created.push({start:i===0?c.start:times[i-1],end:i<times.length?times[i]:c.end,main:segments[i],sub:"",actor:c.actor,group:group,mainStyle:c.mainStyle,subStyle:c.subStyle});}if(trim(c.sub)){subCue={start:c.start,end:c.end,main:"",sub:c.sub,actor:c.actor,group:"",mainStyle:c.mainStyle,subStyle:c.subStyle};created.push(subCue);}state.annotationCues.splice(index,1);for(i=0;i<created.length;i++){state.annotationCues.push(created[i]);}state.recordedCutTimes=[];state.annotationCues.sort(function(a,b){return a.start-b.start||((a.main?0:1)-(b.main?0:1));});for(i=0;i<state.annotationCues.length;i++){if(state.annotationCues[i]===created[0]){index=i;break;}}refreshAnnotationList(index);alert("已切分为 "+segments.length+" 段并建立同一行组 "+group+"。\r现在可逐段修改演唱角色。",APP_NAME);}
    function assToAnnotation(parsed){var out=[],map={},mainStyle=parsed.styles.length?parsed.styles[0]:"JP",subStyle=parsed.styles.length>1?parsed.styles[1]:"CN",i,e,key,c;for(i=0;i<parsed.events.length;i++){e=parsed.events[i];key=Math.round(e.start*1000)+"|"+Math.round(e.end*1000)+"|"+e.actor+"|"+(e.group||"");if(!map[key]){c={start:e.start,end:e.end,main:"",sub:"",actor:e.actor||"NONE",group:e.group||"",mainStyle:mainStyle,subStyle:subStyle};map[key]=c;out.push(c);}c=map[key];if(e.style===mainStyle&&!c.main){c.main=e.text;c.mainStyle=e.style;}else if(e.style===subStyle&&!c.sub){c.sub=e.text;c.subStyle=e.style;}else if(!c.main){c.main=e.text;c.mainStyle=e.style;}else if(!c.sub){c.sub=e.text;c.subStyle=e.style;}else{out.push({start:e.start,end:e.end,main:e.text,sub:"",actor:e.actor||"NONE",group:e.group||"",mainStyle:e.style,subStyle:subStyle});}}out.sort(function(a,b){return a.start-b.start||a.end-b.end;});return out;}
    function importAnnotationFile(){var f=File.openDialog("选择 SRT 或 LRC","Subtitle:*.srt;*.lrc",false);if(!f){return;}try{var text=readTextFile(f),ext=f.name.toLowerCase(),cues=/\.lrc$/.test(ext)?parseLRC(text):parseSRT(text);if(!cues.length){throw new Error("未解析到有效字幕。");}state.annotationSelected=-1;state.annotationFile=f;state.annotationCues=cues;state.ui.annotationPath.text=f.fsName;refreshAnnotationList(0);alert("已导入 "+cues.length+" 条字幕。请在“角色”页加入本项目角色，再逐句勾选演唱者。",APP_NAME);}catch(e){alert("字幕导入失败：\r"+e.toString(),APP_NAME);}}
    function annotationToASS(){if(!annotationSaveCurrent(false)){throw new Error("当前字幕时间无效：结束时间必须晚于开始时间。");}var ids=currentCharacterIds(),events=[],styles=[],i,c,actors,j,a,known,k,mainStyle,subStyle;if(!ids.length){throw new Error("请先在“角色”页创建或添加本项目角色。");}for(i=0;i<state.annotationCues.length;i++){c=state.annotationCues[i];actors=splitSingers(c.actor);if(!actors.length){actors=["NONE"];c.actor="NONE";}for(j=0;j<actors.length;j++){a=actors[j];known=false;for(k=0;k<ids.length;k++){if(ids[k]===a){known=true;break;}}if(a.toUpperCase()!=="ALL"&&a.toUpperCase()!=="NONE"&&!known){throw new Error("第 "+(i+1)+" 条使用了未加入项目的角色："+a);}}mainStyle=c.mainStyle||"JP";subStyle=c.subStyle||"CN";if(trim(c.main)){uniquePush(styles,mainStyle);events.push({start:c.start,end:c.end,style:mainStyle,actor:c.actor,text:c.main,group:c.group||"",line:i+1,singers:actors});}if(trim(c.sub)){uniquePush(styles,subStyle);events.push({start:c.start,end:c.end,style:subStyle,actor:c.actor,text:c.sub,group:c.group||"",line:i+1,singers:actors});}}if(!events.length){throw new Error("没有可用字幕，请添加或填写字幕文本。");}events.sort(function(a,b){if(a.start!==b.start){return a.start-b.start;}return a.style<b.style?-1:(a.style>b.style?1:0);});return{events:events,styles:styles,actorIds:ids};}
    function assSeconds(v){var cs=Math.round(v*100),s=Math.floor(cs/100),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h+":"+pad(m,2)+":"+pad(s%60,2)+"."+pad(cs%100,2);}
    function assFromAnnotation(parsed){var out=["[Script Info]","Title: Annotated Lyrics","ScriptType: v4.00+","PlayResX: 1920","PlayResY: 1080","","[V4+ Styles]","Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"],i,e,style,size,margin,effect;for(i=0;i<parsed.styles.length;i++){style=parsed.styles[i]||("Style"+(i+1));size=i===0?58:34;margin=i===0?150:90;out.push("Style: "+style+",Arial,"+size+",&H00FFFFFF,&H000000FF,&H00101010,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,"+margin+",1");}out.push("");out.push("[Events]");out.push("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text");for(i=0;i<parsed.events.length;i++){e=parsed.events[i];effect=e.group?"LDG_GROUP="+encodeURIComponent(e.group):"";out.push("Dialogue: 0,"+assSeconds(e.start)+","+assSeconds(e.end)+","+e.style+","+e.actor+",0,0,0,"+effect+","+String(e.text).replace(/\r?\n/g,"\\N"));}return out.join("\r\n")+"\r\n";}

    function buildSingerIntervals(events, characters, tolerance) {
        var byId = {}, ids = [], i, j, ev, s, upper, id;
        for (i = 0; i < characters.length; i++) { id = characters[i].id; ids.push(id); byId[id] = []; }
        for (i = 0; i < events.length; i++) {
            ev = events[i];
            for (j = 0; j < ev.singers.length; j++) {
                s = ev.singers[j]; upper = s.toUpperCase();
                if (upper === "NONE") { continue; }
                if (upper === "ALL") {
                    var k; for (k = 0; k < ids.length; k++) { byId[ids[k]].push([ev.start, ev.end]); }
                } else if (byId[s]) { byId[s].push([ev.start, ev.end]); }
            }
        }
        for (i = 0; i < ids.length; i++) {
            var list = byId[ids[i]], merged = [], cur;
            list.sort(function(a,b) { return a[0]-b[0] || a[1]-b[1]; });
            for (j = 0; j < list.length; j++) {
                if (!merged.length || list[j][0] > merged[merged.length-1][1] + tolerance) {
                    merged.push([list[j][0], list[j][1]]);
                } else {
                    cur = merged[merged.length-1]; cur[1] = Math.max(cur[1], list[j][1]);
                }
            }
            byId[ids[i]] = merged;
        }
        return byId;
    }

    // ---------- UI state ----------
    function defaultCharacter(id, index) {
        var palette = ["#86AFFF","#80D8FF","#FF7070","#D58CFF","#FFD166","#62D6A8","#FF9F68","#A4B0BE"];
        return { id: id, displayName: id, secondaryName: "", imageFile: null, color: palette[index % palette.length], scale: 100, offsetX: 0, offsetY: 0 };
    }
    function presetFile(){return new File(Folder.userData.fsName+"/LyricsDistributionGenerator/character-presets.tsv");}
    function presetFromParts(id,p,offset){offset=offset||0;return{displayName:decodeURIComponent(p[offset]||id),color:p[offset+1]||"#FFFFFF",scale:num(p[offset+2],100),offsetX:num(p[offset+3],0),offsetY:num(p[offset+4],0),imagePath:decodeURIComponent(p[offset+5]||""),secondaryName:decodeURIComponent(p[offset+6]||"")};}
    function loadPresetMap(){if(state.presetMap){return state.presetMap;}var map={},f=presetFile(),text,lines,i,p,id,count,data;if(f.exists){try{f.encoding="UTF-8";if(f.open("r")){text=f.read();f.close();lines=text.split(/\r?\n/);for(i=0;i<lines.length;i++){if(!lines[i]){continue;}p=lines[i].split("\t");id=decodeURIComponent(p[0]||"");if(id){map[id]=presetFromParts(id,p,1);}}}}catch(e){}}try{if(app.settings.haveSetting(PRESET_SECTION,"count")){count=intNum(app.settings.getSetting(PRESET_SECTION,"count"),0,0,10000);for(i=0;i<count;i++){id=decodeURIComponent(app.settings.getSetting(PRESET_SECTION,"id_"+i));data=app.settings.getSetting(PRESET_SECTION,"data_"+i);p=data.split("\t");if(id){map[id]=presetFromParts(id,p,0);}}}}catch(settingsReadError){}state.presetMap=map;return map;}
    function characterFromSaved(id,index){var p=loadPresetMap()[id],c=defaultCharacter(id,index);if(!p){return c;}c.displayName=p.displayName;c.secondaryName=p.secondaryName||"";c.color=p.color;c.scale=p.scale;c.offsetX=p.offsetX;c.offsetY=p.offsetY;if(p.imagePath){var f=new File(p.imagePath);if(f.exists){c.imageFile=f;}}return c;}
    function rebuildCharacters(ids){saveCharacterEditor();var old={},chars=[],i;for(i=0;i<state.characters.length;i++){old[state.characters[i].id]=state.characters[i];}for(i=0;i<ids.length;i++){chars.push(old[ids[i]]||characterFromSaved(ids[i],i));}state.characters=chars;refreshCharacterList(0);syncProjectRolesUI();}
    function mergeCharacters(ids){var merged=currentCharacterIds(),i;for(i=0;i<ids.length;i++){uniquePush(merged,ids[i]);}rebuildCharacters(merged);}
    function refreshPresetDrop(){var u=state.ui,map=loadPresetMap(),ids=[],id,i;if(!u.rolePresetDrop){return;}u.rolePresetDrop.removeAll();for(id in map){if(map.hasOwnProperty(id)){ids.push(id);}}ids.sort();for(i=0;i<ids.length;i++){u.rolePresetDrop.add("item",ids[i]);}if(u.rolePresetDrop.items.length){u.rolePresetDrop.selection=0;}}
    function addProjectCharacter(id){id=trim(id);if(!id){alert("请输入 Actor ID。",APP_NAME);return;}if(id.toUpperCase()==="ALL"||id.toUpperCase()==="NONE"||/[+,，;；]/.test(id)){alert("Actor ID 不能使用 ALL、NONE，也不能包含加号、逗号或分号。",APP_NAME);return;}saveCharacterEditor();var i;for(i=0;i<state.characters.length;i++){if(state.characters[i].id===id){refreshCharacterList(i);return;}}state.characters.push(characterFromSaved(id,state.characters.length));refreshCharacterList(state.characters.length-1);syncProjectRolesUI();}
    function createProjectCharacter(){var u=state.ui,id=trim(u.newActorId.text);addProjectCharacter(id);if(id){u.newActorId.text="";}}
    function addPresetCharacter(){var item=state.ui.rolePresetDrop.selection;if(item){addProjectCharacter(item.text);}}
    function removeProjectCharacter(){var i=state.selectedCharacter;if(i<0||i>=state.characters.length){return;}state.characters.splice(i,1);refreshCharacterList(Math.min(i,state.characters.length-1));syncProjectRolesUI();}
    function saveCharacterPresets(){saveCharacterEditor();var map=loadPresetMap(),i,c,id,ids=[];for(i=0;i<state.characters.length;i++){c=state.characters[i];map[c.id]={displayName:c.displayName,secondaryName:c.secondaryName||"",color:c.color,scale:c.scale,offsetX:c.offsetX,offsetY:c.offsetY,imagePath:c.imageFile?c.imageFile.fsName:""};}for(id in map){if(map.hasOwnProperty(id)){ids.push(id);}}ids.sort();try{app.settings.saveSetting(PRESET_SECTION,"count",String(ids.length));for(i=0;i<ids.length;i++){id=ids[i];c=map[id];app.settings.saveSetting(PRESET_SECTION,"id_"+i,encodeURIComponent(id));app.settings.saveSetting(PRESET_SECTION,"data_"+i,encodeURIComponent(c.displayName)+"\t"+c.color+"\t"+c.scale+"\t"+c.offsetX+"\t"+c.offsetY+"\t"+encodeURIComponent(c.imagePath||"")+"\t"+encodeURIComponent(c.secondaryName||""));}state.presetMap=map;refreshPresetDrop();alert("已永久保存 "+state.characters.length+" 个角色样式到 AE 设置。",APP_NAME);}catch(e){alert("保存角色样式失败：\r"+e.toString(),APP_NAME);}}
    function applyAnnotationToProject(){try{var parsed=annotationToASS();state.ass=parsed;rebuildCharacters(parsed.actorIds);refreshStyleDrops();alert("标注已载入项目："+state.annotationCues.length+" 个时间段，"+parsed.actorIds.length+" 个角色。",APP_NAME);}catch(e){alert("应用标注失败：\r"+e.toString(),APP_NAME);}}
    function exportAnnotationASS(){try{var parsed=annotationToASS(),f=File.saveDialog("保存标注后的 ASS","ASS:*.ass");if(!f){return;}if(!/\.ass$/i.test(f.name)){f=new File(f.fsName+".ass");}f.encoding="UTF-8";if(!f.open("w")){throw new Error("无法写入文件。");}f.write("\uFEFF"+assFromAnnotation(parsed));f.close();alert("ASS 已导出：\r"+f.fsName,APP_NAME);}catch(e){alert("导出失败：\r"+e.toString(),APP_NAME);}}
    function saveCharacterEditor() {
        var idx = state.selectedCharacter, u = state.ui;
        if (idx < 0 || idx >= state.characters.length || !u.charName) { return; }
        var c = state.characters[idx];
        c.displayName = trim(u.charName.text) || c.id;
        c.secondaryName = trim(u.charSecondary.text);
        c.color = colorToHex(parseHexColor(u.charColor.text, parseHexColor(c.color)));
        c.scale = num(u.charScale.text, 100, 10, 500);
        c.offsetX = num(u.charX.text, 0, -10000, 10000);
        c.offsetY = num(u.charY.text, 0, -10000, 10000);
    }
    function loadCharacterEditor(index) {
        var u = state.ui, c;
        state.selectedCharacter = index;
        if (index < 0 || index >= state.characters.length) {
            u.charActor.text = "-"; u.charName.text = ""; u.charSecondary.text = ""; u.charImage.text = ""; u.charColor.text = "#FFFFFF";
            u.charScale.text = "100"; u.charX.text = "0"; u.charY.text = "0"; return;
        }
        c = state.characters[index];
        u.charActor.text = c.id; u.charName.text = c.displayName; u.charSecondary.text = c.secondaryName||""; u.charImage.text = c.imageFile ? c.imageFile.fsName : "";
        u.charColor.text = c.color; u.charScale.text = c.scale; u.charX.text = c.offsetX; u.charY.text = c.offsetY;
    }
    function refreshCharacterList(selectIndex) {
        var list = state.ui.charList, i;
        list.removeAll();
        for (i = 0; i < state.characters.length; i++) { list.add("item", (i+1) + ". " + state.characters[i].id); }
        if (state.characters.length) {
            selectIndex = clamp(selectIndex === undefined ? 0 : selectIndex, 0, state.characters.length - 1);
            list.selection = selectIndex; loadCharacterEditor(selectIndex);
        } else { loadCharacterEditor(-1); }
    }
    function refreshStyleDrops() {
        var u = state.ui, styles = state.ass ? state.ass.styles : [], oldMain = selectedText(u.mainStyle), oldSub = selectedText(u.subStyle), i;
        u.mainStyle.removeAll(); u.subStyle.removeAll(); u.subStyle.add("item", NONE_STYLE_LABEL);
        for (i = 0; i < styles.length; i++) { u.mainStyle.add("item", styles[i]); u.subStyle.add("item", styles[i]); }
        setDropSelection(u.mainStyle, oldMain, 0);
        if (styles.length > 1) { setDropSelection(u.subStyle, oldSub && oldSub !== NONE_STYLE_LABEL ? oldSub : styles[1], 2); }
        else { setDropSelection(u.subStyle, NONE_STYLE_LABEL, 0); }
    }
    function readASSFromUI() {
        if (!fileExists(state.assFile)) { alert("请先选择有效的 ASS 字幕文件。", APP_NAME); return; }
        try {
            saveCharacterEditor();
            var parsed = parseASS(readTextFile(state.assFile));
            if (!parsed.events.length) { throw new Error("未找到有效 Dialogue。请检查 [Events]、Format 和时间格式。"); }
            state.ass=parsed;mergeCharacters(parsed.actorIds);refreshStyleDrops();state.annotationSelected=-1;state.annotationFile=state.assFile;state.annotationCues=assToAnnotation(parsed);state.ui.annotationPath.text=state.assFile.fsName;refreshAnnotationList(0);
            alert("读取完成：" + parsed.events.length + " 条 Dialogue，" + parsed.actorIds.length + " 个角色，" + parsed.styles.length + " 个 Style。", APP_NAME);
        } catch (e) { alert("读取 ASS 失败：\r" + e.toString(), APP_NAME); }
    }

    // ---------- AE helpers ----------
    function ensureProject() { if (!app.project) { app.newProject(); } return app.project; }
    function importFootage(file, folder) {
        var item = app.project.importFile(new ImportOptions(file));
        if (folder) { item.parentFolder = folder; }
        return item;
    }
    function setTextLayer(layer, text, options) {
        var prop = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var doc = prop.value;
        doc.text = text;
        try { if (options.font) { doc.font = options.font; } } catch (fontError) {}
        doc.fontSize = options.size;
        doc.applyFill = options.fill===false?false:true; doc.fillColor = options.color;
        doc.applyStroke = !!options.stroke;
        if (options.stroke) { doc.strokeColor = options.strokeColor || [0,0,0]; doc.strokeWidth = options.strokeWidth || 2; try{doc.strokeOverFill=false;}catch(strokeOrderError){} }
        doc.justification = ParagraphJustification.CENTER_JUSTIFY;
        prop.setValue(doc);
        return prop;
    }
    function setTemporalEase(prop) {
        var i, easeIn = [new KeyframeEase(0, 66)], easeOut = [new KeyframeEase(0, 66)];
        try { for (i = 1; i <= prop.numKeys; i++) { prop.setTemporalEaseAtKey(i, easeIn, easeOut); } } catch (e) {}
    }
    function setKey(prop, time, value) { prop.setValueAtTime(Math.max(0, time), value); }
    function addFadeScaleAnimation(layer, start, end, mode, inDur, outDur) {
        var op = layer.property("ADBE Transform Group").property("ADBE Opacity");
        var sc = layer.property("ADBE Transform Group").property("ADBE Scale");
        if (mode === "无动画") { op.setValue(100); return; }
        var inEnd = Math.min(end, start + inDur), outStart = Math.max(start, end - outDur);
        setKey(op, start, 0); setKey(op, inEnd, 100); setKey(op, outStart, 100); setKey(op, end, 0); setTemporalEase(op);
        if (mode === "Scale + Fade") {
            setKey(sc, start, [95,95]); setKey(sc, inEnd, [100,100]); setKey(sc, end, [100,100]); setTemporalEase(sc);
        }
    }
    function addSliderControl(layer,name,value) {
        var fx=layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");fx.name=name;fx.property(1).setValue(value);return fx;
    }
    function addColorControl(layer,name,value) {
        var fx=layer.property("ADBE Effect Parade").addProperty("ADBE Color Control");fx.name=name;fx.property(1).setValue(value);return fx;
    }
    function createFontTemplate(comp,name,font,size) {
        var layer=comp.layers.addText("Font Style Template");layer.name=name;
        setTextLayer(layer,"Font Style Template",{font:font,size:size,color:[1,1,1]});
        layer.enabled=false;layer.shy=false;try{layer.guideLayer=true;}catch(e){}return layer;
    }
    function createMasterControls(comp,settings) {
        var ctrl=comp.layers.addNull(comp.duration);ctrl.name=AUTO+"CONTROLS";ctrl.label=9;
        addSliderControl(ctrl,"Main Font Size",settings.mainSize);addSliderControl(ctrl,"Sub Font Size",settings.subSize);
        addSliderControl(ctrl,"Lyric X",settings.lyricX);addSliderControl(ctrl,"Main Y",settings.mainY);addSliderControl(ctrl,"Sub Y",settings.subY);
        addSliderControl(ctrl,"Lyric Stroke Width",settings.lyricStroke?2:0);addColorControl(ctrl,"Lyric Stroke Color",[0,0,0]);addSliderControl(ctrl,"Lyric Tracking",0);
        addSliderControl(ctrl,"Lyric Master Opacity",100);addSliderControl(ctrl,"Lyric Master Scale",100);
        addColorControl(ctrl,"Lyric Shadow Color",settings.lyricShadowColor);addSliderControl(ctrl,"Lyric Shadow Opacity",settings.lyricShadowEnabled?settings.lyricShadowOpacity:0);addSliderControl(ctrl,"Lyric Shadow Direction",settings.lyricShadowDirection);addSliderControl(ctrl,"Lyric Shadow Distance",settings.lyricShadowDistance);addSliderControl(ctrl,"Lyric Shadow Softness",settings.lyricShadowSoftness);
        addColorControl(ctrl,"Name Shadow Color",settings.nameShadowColor);addSliderControl(ctrl,"Name Shadow Opacity",settings.nameShadowEnabled?settings.nameShadowOpacity:0);addSliderControl(ctrl,"Name Shadow Direction",settings.nameShadowDirection);addSliderControl(ctrl,"Name Shadow Distance",settings.nameShadowDistance);addSliderControl(ctrl,"Name Shadow Softness",settings.nameShadowSoftness);
        var mainFont=createFontTemplate(comp,AUTO+"FONT_MAIN_STYLE",settings.mainFont,settings.mainSize);
        var subFont=createFontTemplate(comp,AUTO+"FONT_SUB_STYLE",settings.subFont,settings.subSize);
        return {control:ctrl,mainFont:mainFont,subFont:subFont};
    }
    function attachLyricMasterControls(layer,textProp,kind,fitRatio,xOffset,baseMasterSize) {
        var sizeName=kind==="MAIN"?"Main Font Size":"Sub Font Size",yName=kind==="MAIN"?"Main Y":"Sub Y",fontLayer=kind==="MAIN"?AUTO+"FONT_MAIN_STYLE":AUTO+"FONT_SUB_STYLE";
        var ratioText=String(Math.max(0.01,fitRatio));
        xOffset=xOffset||0;baseMasterSize=baseMasterSize||1;
        try{textProp.expression='var c=thisComp.layer("'+AUTO+'CONTROLS");var f=thisComp.layer("'+fontLayer+'").text.sourceText.style.font;var sw=c.effect("Lyric Stroke Width")(1);text.sourceText.style.setFont(f).setFontSize(c.effect("'+sizeName+'")(1)*'+ratioText+').setApplyStroke(sw>0).setStrokeWidth(sw).setStrokeColor(c.effect("Lyric Stroke Color")(1)).setTracking(c.effect("Lyric Tracking")(1));';}catch(e1){}
        try{layer.property("ADBE Transform Group").property("ADBE Position").expression='var c=thisComp.layer("'+AUTO+'CONTROLS");[c.effect("Lyric X")(1)+'+String(xOffset)+'*c.effect("'+sizeName+'")(1)/'+String(baseMasterSize)+',c.effect("'+yName+'")(1)];';}catch(e2){}
        try{layer.property("ADBE Transform Group").property("ADBE Opacity").expression='value*thisComp.layer("'+AUTO+'CONTROLS").effect("Lyric Master Opacity")(1)/100;';}catch(e3){}
        try{layer.property("ADBE Transform Group").property("ADBE Scale").expression='value*thisComp.layer("'+AUTO+'CONTROLS").effect("Lyric Master Scale")(1)/100;';}catch(e4){}
    }
    function addGlow(layer, color, intensity, radius) {
        var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
        if (!fx) { return null; }
        fx.name = AUTO + "Glow";
        try { fx.property("ADBE Glo2-0003").setValue(radius); } catch (e1) { try { fx.property(3).setValue(radius); } catch (e2) {} }
        try { fx.property("ADBE Glo2-0004").setValue(intensity); } catch (e3) { try { fx.property(4).setValue(intensity); } catch (e4) {} }
        try { fx.property("ADBE Glo2-0007").setValue(2); } catch (e5) { try { fx.property(7).setValue(2); } catch (e6) {} }
        try { fx.property("ADBE Glo2-0011").setValue(color); fx.property("ADBE Glo2-0012").setValue(color); } catch (e7) { try { fx.property(11).setValue(color); fx.property(12).setValue(color); } catch (e8) {} }
        return fx;
    }
    function addUnifiedDropShadow(layer,effectName,color,opacity,direction,distance,softness,controlPrefix){var fx=layer.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow"),ctrl=null;if(!fx){return null;}fx.name=AUTO+effectName;try{fx.property(1).setValue(color);}catch(e1){}try{fx.property(2).setValue(opacity);}catch(e2){}try{fx.property(3).setValue(direction);}catch(e3){}try{fx.property(4).setValue(distance);}catch(e4){}try{fx.property(5).setValue(softness);}catch(e5){}try{fx.property(6).setValue(0);}catch(e6){}if(controlPrefix){try{ctrl=layer.containingComp.layer(AUTO+"CONTROLS");}catch(findError){}if(ctrl){try{fx.property(1).expression='thisComp.layer("'+AUTO+'CONTROLS").effect("'+controlPrefix+' Shadow Color")(1);';}catch(x1){}try{fx.property(2).expression='thisComp.layer("'+AUTO+'CONTROLS").effect("'+controlPrefix+' Shadow Opacity")(1);';}catch(x2){}try{fx.property(3).expression='thisComp.layer("'+AUTO+'CONTROLS").effect("'+controlPrefix+' Shadow Direction")(1);';}catch(x3){}try{fx.property(4).expression='thisComp.layer("'+AUTO+'CONTROLS").effect("'+controlPrefix+' Shadow Distance")(1);';}catch(x4){}try{fx.property(5).expression='thisComp.layer("'+AUTO+'CONTROLS").effect("'+controlPrefix+' Shadow Softness")(1);';}catch(x5){}}}return fx;}
    function glowIntensityProperty(fx) {
        if (!fx) { return null; }
        try { return fx.property("ADBE Glo2-0004") || fx.property(4); } catch (e) { return null; }
    }
    function addInactiveTint(layer, color, amount) {
        var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Tint");
        if (!fx) { return null; }
        fx.name = AUTO + "Inactive_Tint";
        var dark = [color[0]*0.06,color[1]*0.06,color[2]*0.06];
        try { fx.property(1).setValue(dark); } catch (e1) {}
        try { fx.property(2).setValue(color); } catch (e2) {}
        try { fx.property(3).setValue(amount); } catch (e3) {}
        return fx;
    }
    function createEdgeGlow(comp, width, height, color, radius) {
        var layer=comp.layers.addShape();layer.name=AUTO+"Edge_Glow";
        var root=layer.property("ADBE Root Vectors Group");
        var rect=root.addProperty("ADBE Vector Shape - Rect");
        var inset=Math.max(8,Math.min(radius*0.45,Math.min(width,height)*0.12));
        rect.property("ADBE Vector Rect Size").setValue([Math.max(4,width-inset*2),Math.max(4,height-inset*2)]);
        rect.property("ADBE Vector Rect Position").setValue([0,0]);
        var stroke=root.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("ADBE Vector Stroke Color").setValue(color);
        stroke.property("ADBE Vector Stroke Width").setValue(Math.max(3,Math.min(8,radius*0.14)));
        setLayerPosition(layer,[width/2,height/2]);setLayerOpacity(layer,0);
        var glow=addGlow(layer,color,0,radius);
        return {layer:layer,glow:glow};
    }
    function tintAmountProperty(fx) {
        if (!fx) { return null; }
        try { return fx.property(3); } catch (e) { return null; }
    }
    function singerColorForEvent(ev, fallbackColor) {
        var j,singer,i;
        if(!ev||!ev.singers){return fallbackColor;}
        for(j=0;j<ev.singers.length;j++){
            singer=ev.singers[j];
            if(singer.toUpperCase()==="NONE"){continue;}
            if(singer.toUpperCase()==="ALL"){return state.characters.length?parseHexColor(state.characters[0].color,fallbackColor):fallbackColor;}
            for(i=0;i<state.characters.length;i++){if(state.characters[i].id===singer){return parseHexColor(state.characters[i].color,fallbackColor);}}
        }
        return fallbackColor;
    }
    function characterColor(id,fallback) {
        var i;for(i=0;i<state.characters.length;i++){if(state.characters[i].id===id){return parseHexColor(state.characters[i].color,fallback);}}
        return fallback;
    }
    function eventSingerInfo(ev) {
        var ids=[],all=false,i,s;
        if(ev&&ev.singers){for(i=0;i<ev.singers.length;i++){s=ev.singers[i];if(s.toUpperCase()==="NONE"){continue;}if(s.toUpperCase()==="ALL"){all=true;}else{uniquePush(ids,s);}}}
        return {ids:ids,all:all};
    }
    function colorsForMode(mode,ids,colorA,colorB,fallback) {
        var colors=[],i;
        if(mode==="固定颜色"){return [colorA];}
        if(mode==="自定义渐变"){return [colorA,colorB];}
        for(i=0;i<ids.length;i++){colors.push(characterColor(ids[i],fallback));}
        return colors.length?colors:[fallback];
    }
    function themeForEvent(ev,settings) {
        var info=eventSingerInfo(ev),ids=[],i;
        if(info.all){
            for(i=0;i<state.characters.length;i++){ids.push(state.characters[i].id);}
            return {colors:colorsForMode(settings.allColorMode,ids,settings.allColorA,settings.allColorB,settings.bannerColor),kind:"all"};
        }
        if(info.ids.length===1){return {colors:[characterColor(info.ids[0],settings.bannerColor)],kind:"solo"};}
        if(info.ids.length>1){return {colors:colorsForMode(settings.multiColorMode,info.ids,settings.multiColorA,settings.multiColorB,settings.bannerColor),kind:"multi"};}
        for(i=0;i<state.characters.length;i++){ids.push(parseHexColor(state.characters[i].color,settings.bannerColor));}
        return {colors:ids.length?ids:[settings.bannerColor],kind:"none"};
    }
    function lerpColor(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
    function themeColorAt(theme,t) {
        var colors=theme.colors;if(colors.length===1){return colors[0];}
        t=clamp(t,0,1);var scaled=t*(colors.length-1),i=Math.min(colors.length-2,Math.floor(scaled));return lerpColor(colors[i],colors[i+1],scaled-i);
    }
    function sameColor(a,b) {
        return Math.abs(a[0]-b[0])<0.0001&&Math.abs(a[1]-b[1])<0.0001&&Math.abs(a[2]-b[2])<0.0001;
    }
    function animateThemeColor(prop,events,settings,duration,sampleT,darkFactor,grayAmount) {
        var list=[],i,ev,noneTheme=themeForEvent(null,settings),current=themeColorAt(noneTheme,sampleT),next,lastEnd=0,pre,post,color;
        function adjusted(c){var g,r=[c[0],c[1],c[2]],mix=grayAmount||0;if(mix>0){g=c[0]*0.299+c[1]*0.587+c[2]*0.114;r=[c[0]*(1-mix)+g*mix,c[1]*(1-mix)+g*mix,c[2]*(1-mix)+g*mix];}return darkFactor?[r[0]*darkFactor,r[1]*darkFactor,r[2]*darkFactor]:r;}
        prop.setValue(adjusted(current));setKey(prop,0,adjusted(current));
        for(i=0;i<events.length;i++){if(events[i].style===settings.mainStyle){list.push(events[i]);}}
        for(i=0;i<list.length;i++){
            ev=list[i];next=themeColorAt(themeForEvent(ev,settings),sampleT);
            if(ev.start>lastEnd+1/settings.fps&&lastEnd>0){
                color=themeColorAt(noneTheme,sampleT);post=Math.min(duration,lastEnd+settings.transition);setKey(prop,lastEnd,adjusted(current));setKey(prop,post,adjusted(color));current=color;
            }
            if(!sameColor(current,next)){
                pre=Math.max(0,ev.start-settings.transition);setKey(prop,pre,adjusted(current));setKey(prop,ev.start,adjusted(next));current=next;
            }
            lastEnd=Math.max(lastEnd,ev.end);
        }
        if(lastEnd>0){color=themeColorAt(noneTheme,sampleT);post=Math.min(duration,lastEnd+settings.transition);setKey(prop,lastEnd,adjusted(current));setKey(prop,post,adjusted(color));}
        setTemporalEase(prop);
    }
    function animateTintColors(fx,events,settings,duration,sampleT) {
        if(!fx){return;}animateThemeColor(fx.property(1),events,settings,duration,sampleT,0.08,0.85);animateThemeColor(fx.property(2),events,settings,duration,sampleT,settings.inactiveLightFactor,settings.inactiveGrayAmount);
    }
    function animateNameLayer(layer, intervals, transition, duration) {
        if(!layer){return;}
        var op=layer.property("ADBE Transform Group").property("ADBE Opacity"),i,a,b,pre,post;
        op.setValue(0);setKey(op,0,0);
        for(i=0;i<intervals.length;i++){
            a=clamp(intervals[i][0],0,duration);b=clamp(intervals[i][1],0,duration);
            pre=Math.max(0,a-transition);post=Math.min(duration,b+transition);
            setKey(op,pre,0);setKey(op,a,100);setKey(op,b,100);setKey(op,post,0);
        }
        setKey(op,duration,0);setTemporalEase(op);
    }
    function fitLayerToBox(layer, sourceW, sourceH, boxW, boxH, modeFill) {
        var factor = modeFill ? Math.max(boxW/sourceW, boxH/sourceH) : Math.min(boxW/sourceW, boxH/sourceH);
        layer.property("ADBE Transform Group").property("ADBE Scale").setValue([factor*100, factor*100]);
    }
    function autoFitText(layer, textProp, maxWidth, minSize) {
        var attempts = 0, rect, doc;
        try {
            while (attempts < 12) {
                rect = layer.sourceRectAtTime(layer.inPoint, false);
                if (rect.width <= maxWidth || rect.width <= 0) { break; }
                doc = textProp.value;
                if (doc.fontSize <= minSize) { break; }
                doc.fontSize = Math.max(minSize, doc.fontSize * maxWidth / rect.width * 0.98);
                textProp.setValue(doc); attempts++;
            }
        } catch (e) {}
    }
    function setLayerPosition(layer, xy) { layer.property("ADBE Transform Group").property("ADBE Position").setValue(xy); }
    function setLayerOpacity(layer, value) { layer.property("ADBE Transform Group").property("ADBE Opacity").setValue(value); }
    function setLayerScale(layer, value) { layer.property("ADBE Transform Group").property("ADBE Scale").setValue([value,value]); }

    // ---------- Layout and animation ----------
    function calculateLayout(count, centerX, centerY, charSize, gap, maxWidth) {
        var rows = count <= 5 ? 1 : 2, rowCounts = [], positions = [], r, i, n, width, x, y, scale = 1;
        if (rows === 1) { rowCounts = [count]; }
        else { rowCounts = [Math.ceil(count/2), Math.floor(count/2)]; }
        var widest = rowCounts[0];
        width = widest * charSize + Math.max(0,widest-1)*gap;
        if (width > maxWidth) { scale = maxWidth / width; }
        var effectiveSize = charSize * scale, effectiveGap = gap * scale;
        for (r = 0; r < rowCounts.length; r++) {
            n = rowCounts[r]; width = n*effectiveSize + Math.max(0,n-1)*effectiveGap;
            y = centerY + (r - (rows-1)/2) * (effectiveSize + effectiveGap*0.65);
            for (i = 0; i < n; i++) {
                x = centerX - width/2 + effectiveSize/2 + i*(effectiveSize+effectiveGap);
                positions.push({x:x, y:y, layoutScale:scale});
            }
        }
        return positions;
    }
    function calculateTopStripLayout(count, compWidth, portraitHeight) {
        var positions = [], i, left, right, cellW;
        for (i = 0; i < count; i++) {
            left = Math.round(compWidth * i / count);
            right = Math.round(compWidth * (i + 1) / count);
            cellW = right - left;
            positions.push({
                x: (left + right) / 2,
                y: portraitHeight / 2,
                layoutScale: 1,
                cellW: cellW,
                cellH: portraitHeight
            });
        }
        return positions;
    }
    function animateCharacter(mainLayer, portraitLayer, glowFx, tintFx, intervals, cfg, duration) {
        var trans = cfg.transition, inactiveOpacity = cfg.inactiveOpacity, activeScale = cfg.activeScale;
        var op = mainLayer.property("ADBE Transform Group").property("ADBE Opacity");
        var sc = mainLayer.property("ADBE Transform Group").property("ADBE Scale");
        var gp = glowIntensityProperty(glowFx), tp = tintAmountProperty(tintFx), baseScale = cfg.baseScale;
        op.setValue(inactiveOpacity); sc.setValue([baseScale,baseScale]); if (gp) { gp.setValue(0); } if(tp){tp.setValue(cfg.inactiveTintAmount);}
        setKey(op, 0, inactiveOpacity); setKey(sc, 0, [baseScale,baseScale]); if (gp) { setKey(gp,0,0); } if(tp){setKey(tp,0,cfg.inactiveTintAmount);}
        var i, a, b, pre, post;
        for (i = 0; i < intervals.length; i++) {
            a = clamp(intervals[i][0],0,duration); b = clamp(intervals[i][1],0,duration);
            pre = Math.max(0, a-trans); post = Math.min(duration, b+trans);
            setKey(op,pre,inactiveOpacity); setKey(op,a,100); setKey(op,b,100); setKey(op,post,inactiveOpacity);
            setKey(sc,pre,[baseScale,baseScale]); setKey(sc,a,[baseScale*activeScale/100,baseScale*activeScale/100]);
            setKey(sc,b,[baseScale*activeScale/100,baseScale*activeScale/100]); setKey(sc,post,[baseScale,baseScale]);
            if (gp) { setKey(gp,pre,0); setKey(gp,a,cfg.glowIntensity); setKey(gp,b,cfg.glowIntensity); setKey(gp,post,0); }
            if (tp) { setKey(tp,pre,cfg.inactiveTintAmount); setKey(tp,a,0); setKey(tp,b,0); setKey(tp,post,cfg.inactiveTintAmount); }
        }
        setKey(op,duration,inactiveOpacity); setKey(sc,duration,[baseScale,baseScale]); if (gp) { setKey(gp,duration,0); } if(tp){setKey(tp,duration,cfg.inactiveTintAmount);}
        setTemporalEase(op); setTemporalEase(sc); if (gp) { setTemporalEase(gp); } if(tp){setTemporalEase(tp);}
    }

    // ---------- Settings and validation ----------
    function collectSettings() {
        saveCharacterEditor();
        var u=state.ui,bannerText=u.bannerText.text,bannerSize=num(u.bannerSize.text,42,1,500),bannerPadding=num(u.bannerHeight.text,10,0,500);
        return {
            width:intNum(u.width.text,1920,16,30000), height:intNum(u.height.text,1080,16,30000), fps:num(u.fps.text,30,1,240),
            compName:trim(u.compName.text)||"Lyrics Distribution", bgColor:parseHexColor(u.bgColor.text,[1,1,1]),
            layoutMode:selectedText(u.layoutMode), portraitHeight:num(u.portraitHeight.text,540,80,10000), showNames:u.showNames.value,
            nameFont:trim(u.nameFont.text), nameSize:num(u.nameSize.text,52,6,500), nameSecondSize:num(u.nameSecondSize.text,30,6,500), nameStrokeColor:parseHexColor(u.nameStrokeColor.text,[1,1,1]), nameStrokeWidth:num(u.nameStrokeWidth.text,5,0,100), nameShadowEnabled:u.nameShadowEnabled.value, nameShadowColor:parseHexColor(u.nameShadowColor.text,[0,0,0]), nameShadowOpacity:num(u.nameShadowOpacity.text,55,0,100), nameShadowDirection:num(u.nameShadowDirection.text,135,-360,360), nameShadowDistance:num(u.nameShadowDistance.text,5,0,1000), nameShadowSoftness:num(u.nameShadowSoftness.text,14,0,1000),
            bannerEnabled:u.bannerEnabled.value, bannerHeight:calculateBannerHeight(bannerText,bannerSize,bannerPadding), bannerColor:parseHexColor(u.bannerColor.text,[0.965,0.733,0.835]),
            multiColorMode:selectedText(u.multiColorMode), multiColorA:parseHexColor(u.multiColorA.text,[0.525,0.686,1]), multiColorB:parseHexColor(u.multiColorB.text,[1,0.439,0.439]),
            allColorMode:selectedText(u.allColorMode), allColorA:parseHexColor(u.allColorA.text,[0.965,0.733,0.835]), allColorB:parseHexColor(u.allColorB.text,[0.525,0.686,1]),
            bannerText:bannerText, bannerFont:trim(u.bannerFont.text), bannerSize:bannerSize, bannerTextColor:parseHexColor(u.bannerTextColor.text,[1,1,1]),
            layoutX:num(u.layoutX.text,960,-30000,30000), layoutY:num(u.layoutY.text,560,-30000,30000),
            charSize:num(u.charSize.text,260,20,4000), charGap:num(u.charGap.text,40,-1000,4000), maxLayoutWidth:num(u.maxLayoutWidth.text,1700,100,30000),
            inactiveOpacity:num(u.inactiveOpacity.text,100,0,100), activeScale:num(u.activeScale.text,100,1,300),
            glowEnabled:false, glowIntensity:0, glowRadius:0,
            inactiveTint:u.inactiveTint.value, inactiveTintAmount:num(u.inactiveTintAmount.text,90,0,100), inactiveLightFactor:num(u.inactiveLightFactor.text,58,5,100)/100, inactiveGrayAmount:num(u.inactiveGrayAmount.text,65,0,100)/100, bannerShadowOpacity:num(u.bannerGlow.text,82,0,100), bannerShadowSize:num(u.bannerGlowRadius.text,100,0,500), bannerBottomShadowSize:num(u.bannerBottomGlowRadius.text,65,0,500), bannerActiveShadowOpacity:num(u.bannerActiveGlow.text,88,0,100), bannerActiveShadowSize:num(u.bannerActiveGlowRadius.text,190,0,1000),
            transition:num(u.transition.text,0.12,0,10),
            mainStyle:selectedText(u.mainStyle), subStyle:selectedText(u.subStyle),
            mainFont:trim(u.mainFont.text), mainSize:num(u.mainSize.text,58,1,1000), mainMinSize:num(u.mainMinSize.text,28,1,1000), mainColor:parseHexColor(u.mainColor.text,[1,1,1]), mainY:num(u.mainY.text,820,-30000,30000),
            subFont:trim(u.subFont.text), subSize:num(u.subSize.text,34,1,1000), subMinSize:num(u.subMinSize.text,18,1,1000), subColor:parseHexColor(u.subColor.text,[1,1,1]), subY:num(u.subY.text,895,-30000,30000),
            lyricX:num(u.lyricX.text,960,-30000,30000), maxLyricWidth:num(u.maxLyricWidth.text,1500,50,30000),
            lyricAnimation:selectedText(u.lyricAnimation), lyricIn:num(u.lyricIn.text,0.15,0,10), lyricOut:num(u.lyricOut.text,0.12,0,10), lyricFollowSinger:u.lyricFollowSinger.value, lyricStroke:u.lyricStroke.value, lyricShadowEnabled:u.lyricShadowEnabled.value, lyricShadowColor:parseHexColor(u.lyricShadowColor.text,[0,0,0]), lyricShadowOpacity:num(u.lyricShadowOpacity.text,48,0,100), lyricShadowDirection:num(u.lyricShadowDirection.text,135,-360,360), lyricShadowDistance:num(u.lyricShadowDistance.text,5,0,1000), lyricShadowSoftness:num(u.lyricShadowSoftness.text,16,0,1000),
            spectrumEnabled:u.spectrumEnabled.value, spectrumMode:selectedText(u.spectrumMode), spectrumFile:trim(u.spectrumPath.text)?new File(trim(u.spectrumPath.text)):null, spectrumCompName:trim(u.spectrumCompName.text), spectrumAudioLayer:trim(u.spectrumAudioLayer.text), spectrumX:num(u.spectrumX.text,960,-30000,30000), spectrumY:num(u.spectrumY.text,1050,-30000,30000), spectrumScale:num(u.spectrumScale.text,100,1,1000), spectrumWidth:num(u.spectrumWidth.text,720,10,30000), spectrumStartFreq:num(u.spectrumStartFreq.text,200,1,50000), spectrumEndFreq:num(u.spectrumEndFreq.text,2000,1,50000), spectrumBands:intNum(u.spectrumBands.text,47,2,1024), spectrumMaxHeight:num(u.spectrumMaxHeight.text,220,1,10000), spectrumDurationMs:num(u.spectrumDurationMs.text,90,1,10000), spectrumThickness:num(u.spectrumThickness.text,4,0.1,1000), spectrumSoftness:num(u.spectrumSoftness.text,50,0,100), spectrumColor:parseHexColor(u.spectrumColor.text,[0,0,0]), spectrumMinimax:num(u.spectrumMinimax.text,2,0,1000), spectrumContrast:num(u.spectrumContrast.text,50,-100,100), spectrumMirror:u.spectrumMirror.value, spectrumSide:selectedText(u.spectrumSide), spectrumAfterIntro:u.spectrumAfterIntro.value,
            coverEnabled:u.coverEnabled.value, introEnabled:u.introEnabled.value, coverDuration:num(u.coverDuration.text,5,0.1,120), coverTitleMode:selectedText(u.coverTitleMode), coverLogoFile:trim(u.coverLogoPath.text)?new File(trim(u.coverLogoPath.text)):null, coverLogoWidth:num(u.coverLogoWidth.text,1100,20,30000), songTitle:trim(u.songTitle.text), songTitleFont:trim(u.songTitleFont.text), songTitleSize:num(u.songTitleSize.text,130,6,1000), songTitleColor:parseHexColor(u.songTitleColor.text,[1,1,1]), songTitleGlow:num(u.songTitleGlow.text,0,0,10), songTitleGlowRadius:num(u.songTitleGlowRadius.text,35,0,500), coverInfo:u.coverInfo.text, coverInfoFont:trim(u.coverInfoFont.text), coverInfoSize:num(u.coverInfoSize.text,34,6,500), coverInfoColor:parseHexColor(u.coverInfoColor.text,[0.3,0.3,0.3]), coverTitleY:positionValue(u.coverTitleY.text,intNum(u.height.text,1080,16,30000),0.75), coverInfoY:num(u.coverInfoY.text,930,-30000,30000)
        };
    }
    function validate(settings) {
        var errors = [], i, c, missing = [];
        if (!state.ass || !state.ass.events.length) { errors.push("请先读取 ASS，或在字幕标注页应用 SRT/LRC 标注。"); }
        if (!state.characters.length) { errors.push("没有识别到角色。"); }
        for (i=0;i<state.characters.length;i++) { c=state.characters[i]; if (!fileExists(c.imageFile)) { missing.push(c.id); } }
        if (missing.length) { errors.push("以下角色尚未配置有效图片：\r" + missing.join("、")); }
        if (state.audioFile && !state.audioFile.exists) { errors.push("歌曲文件不存在。"); }
        if (state.bgFile && !state.bgFile.exists) { errors.push("背景文件不存在。"); }
        if (settings.spectrumEnabled && settings.spectrumMode==="外部 AEP" && (!settings.spectrumFile || !settings.spectrumFile.exists)) { errors.push("已启用外部频谱，但频谱模板 AEP 不存在。"); }
        if (settings.spectrumEnabled && settings.spectrumMode==="外部 AEP" && (!settings.spectrumCompName || !settings.spectrumAudioLayer)) { errors.push("外部频谱模板需要填写合成名和音频占位层名。"); }
        if (settings.spectrumEnabled && !fileExists(state.audioFile)) { errors.push("启用频谱时必须选择音乐文件。"); }
        if (!settings.mainStyle) { errors.push("请选择主歌词 Style。"); }
        if (settings.mainStyle && state.ass.styles.join("\n").indexOf(settings.mainStyle) < 0) { errors.push("主歌词 Style 不存在：" + settings.mainStyle); }
        if (settings.subStyle !== NONE_STYLE_LABEL && state.ass.styles.join("\n").indexOf(settings.subStyle) < 0) { errors.push("副歌词 Style 不存在：" + settings.subStyle); }
        if (settings.subStyle === settings.mainStyle) { errors.push("主、副歌词 Style 不能相同；不需要副歌词时请选择 [无]。"); }
        return errors;
    }

    function snapshotCharacters(){var out=[],i,c;for(i=0;i<state.characters.length;i++){c=state.characters[i];out.push({id:c.id,displayName:c.displayName,secondaryName:c.secondaryName||"",color:c.color,scale:c.scale,offsetX:c.offsetX,offsetY:c.offsetY,imagePath:c.imageFile?c.imageFile.fsName:""});}return out;}
    function writeProjectMetadata(comp){var data={version:VERSION,assText:assFromAnnotation(state.ass),cues:state.annotationCues,characters:snapshotCharacters(),config:snapshotUIConfig(),assPath:state.assFile?state.assFile.fsName:"",audioPath:state.audioFile?state.audioFile.fsName:"",bgPath:state.bgFile?state.bgFile.fsName:"",annotationPath:state.annotationFile?state.annotationFile.fsName:""},encoded,layer,prop,doc;try{encoded=encodeURIComponent(JSON.stringify(data));layer=comp.layers.addText(encoded);layer.name=AUTO+"PROJECT_DATA";prop=layer.property("ADBE Text Properties").property("ADBE Text Document");doc=prop.value;doc.text=encoded;prop.setValue(doc);layer.enabled=false;layer.shy=true;try{layer.guideLayer=true;}catch(e1){}}catch(e){throw new Error("无法写入项目恢复数据："+e.toString());}}
    function fileFromSavedPath(path){if(!trim(path)){return null;}var f=new File(path);return f.exists?f:null;}
    function restoreFromSelectedComp(){var comp,layer,prop,text,data,parsed,i,c,chars=[];try{comp=app.project&&app.project.activeItem;if(!(comp instanceof CompItem)){alert("请先在项目面板或时间线中选中一个由本脚本生成的主合成。",APP_NAME);return;}try{layer=comp.layer(AUTO+"PROJECT_DATA");}catch(e1){layer=null;}if(!layer){alert("选中的合成没有恢复数据。旧版本生成的合成需要重新生成一次后才能使用此功能。",APP_NAME);return;}prop=layer.property("ADBE Text Properties").property("ADBE Text Document");text=prop.value.text;data=JSON.parse(decodeURIComponent(text));parsed=parseASS(data.assText);state.ass=parsed;state.annotationCues=data.cues||assToAnnotation(parsed);state.annotationSelected=-1;for(i=0;i<(data.characters||[]).length;i++){c=data.characters[i];chars.push({id:c.id,displayName:c.displayName||c.id,secondaryName:c.secondaryName||"",color:c.color||"#FFFFFF",scale:num(c.scale,100),offsetX:num(c.offsetX,0),offsetY:num(c.offsetY,0),imageFile:fileFromSavedPath(c.imagePath)});}state.characters=chars;state.assFile=fileFromSavedPath(data.assPath);state.audioFile=fileFromSavedPath(data.audioPath);state.bgFile=fileFromSavedPath(data.bgPath);state.annotationFile=fileFromSavedPath(data.annotationPath);applyUIConfig(data.config||{});state.ui.assPath.text=state.assFile?state.assFile.fsName:"";state.ui.audioPath.text=state.audioFile?state.audioFile.fsName:"";state.ui.bgPath.text=state.bgFile?state.bgFile.fsName:"";state.ui.annotationPath.text=state.annotationFile?state.annotationFile.fsName:"已从合成恢复";refreshCharacterList(0);refreshStyleDrops();refreshAnnotationList(0);syncProjectRolesUI();alert("已从合成恢复字幕、角色、素材路径和生成配置。\r修改后点击“生成 AE 合成”即可生成新版本。",APP_NAME);}catch(e){alert("恢复合成数据失败：\r"+e.toString()+(e.line?"\r行号："+e.line:""),APP_NAME);}}

    // ---------- Composition generator ----------
    function createBackground(comp, folder, settings) {
        var layer;
        if (fileExists(state.bgFile)) {
            var item = importFootage(state.bgFile, folder); layer = comp.layers.add(item); layer.name = AUTO+"BG";
            fitLayerToBox(layer,item.width,item.height,settings.width,settings.height,true); setLayerPosition(layer,[settings.width/2,settings.height/2]);
        } else { layer = comp.layers.addSolid(settings.bgColor,AUTO+"BG",settings.width,settings.height,1,comp.duration); }
        layer.moveToEnd(); layer.locked = true; return layer;
    }
    function createAudio(comp, folder) {
        if (!fileExists(state.audioFile)) { return null; }
        var item=importFootage(state.audioFile,folder), layer=comp.layers.add(item); layer.name=AUTO+"AUDIO"; return layer;
    }
    function addAnimatedNamePair(comp,text,suffix,pos,font,size,color,settings,intervals,duration,nameLayers){var outline=comp.layers.addText(text),fill;outline.name=AUTO+"NAME_OUTLINE_"+suffix;setTextLayer(outline,text,{font:font,size:size,color:color,fill:false,stroke:true,strokeColor:settings.nameStrokeColor,strokeWidth:settings.nameStrokeWidth});addUnifiedDropShadow(outline,"Name Shadow",settings.nameShadowColor,settings.nameShadowEnabled?settings.nameShadowOpacity:0,settings.nameShadowDirection,settings.nameShadowDistance,settings.nameShadowSoftness,"Name");setLayerPosition(outline,pos);animateNameLayer(outline,intervals,settings.transition,duration);nameLayers.push(outline);fill=comp.layers.addText(text);fill.name=AUTO+"NAME_COLOR_"+suffix;setTextLayer(fill,text,{font:font,size:size,color:color,stroke:false});setLayerPosition(fill,pos);animateNameLayer(fill,intervals,settings.transition,duration);nameLayers.push(fill);}
    function createCharacter(comp, folder, character, pos, intervals, settings, duration, index, nameLayers) {
        var isStrip=settings.layoutMode==="顶部拼贴";
        var preW=isStrip?Math.max(16,Math.round(pos.cellW)):Math.max(64,Math.round(settings.charSize));
        var preH=isStrip?Math.max(16,Math.round(pos.cellH)):Math.max(96,Math.round(settings.charSize*1.22));
        var pre=app.project.items.addComp(AUTO+"CHAR_"+safeName(character.id),preW,preH,1,duration,settings.fps); pre.parentFolder=folder;
        var item=importFootage(character.imageFile,folder), portrait=pre.layers.add(item); portrait.name=AUTO+"Portrait";
        fitLayerToBox(portrait,item.width,item.height,preW,isStrip?preH:settings.charSize,isStrip);
        setLayerPosition(portrait,[preW/2+(isStrip?character.offsetX:0),(isStrip?preH:settings.charSize)/2+(isStrip?character.offsetY:0)]);
        var portraitScale=portrait.property("ADBE Transform Group").property("ADBE Scale").value;
        portrait.property("ADBE Transform Group").property("ADBE Scale").setValue([portraitScale[0]*character.scale/100,portraitScale[1]*character.scale/100]);
        var color=parseHexColor(character.color,parseHexColor(defaultCharacter(character.id,index).color,[1,1,1]));
        var tint=settings.inactiveTint?addInactiveTint(portrait,color,settings.inactiveTintAmount):null;
        var glow=null;
        var namePos=null,localNameY,secondaryY,mainX=pos.x+(isStrip?0:character.offsetX),mainY=pos.y+(isStrip?0:character.offsetY),hasSecondary=!!trim(character.secondaryName);
        var main=comp.layers.add(pre); main.name=AUTO+"CHAR_"+safeName(character.id);
        setLayerPosition(main,[mainX,mainY]);
        var baseScale=pos.layoutScale*100;
        if(settings.showNames){
            localNameY=isStrip?preH-(hasSecondary?Math.max(78,settings.nameSecondSize+settings.nameSize*0.72):Math.max(55,settings.nameSize*1.15)):settings.charSize+Math.max(18,settings.nameSize*0.65);namePos=[mainX,mainY+(localNameY-preH/2)*pos.layoutScale];
            addAnimatedNamePair(comp,character.displayName,safeName(character.id),namePos,settings.nameFont,settings.nameSize*pos.layoutScale,color,settings,intervals,duration,nameLayers);
            if(hasSecondary){secondaryY=localNameY+settings.nameSize*0.72;namePos=[mainX,mainY+(secondaryY-preH/2)*pos.layoutScale];addAnimatedNamePair(comp,character.secondaryName,safeName(character.id)+"_SECOND",namePos,settings.nameFont,settings.nameSecondSize*pos.layoutScale,color,settings,intervals,duration,nameLayers);}
        }
        animateTintColors(tint,state.ass.events,settings,duration,state.characters.length<=1?0:index/(state.characters.length-1));
        animateCharacter(main,portrait,glow,tint,intervals,{transition:settings.transition,inactiveOpacity:settings.inactiveOpacity,activeScale:settings.activeScale,baseScale:baseScale,glowIntensity:settings.glowIntensity,inactiveTintAmount:settings.inactiveTintAmount},duration);
        return main;
    }
    function lyricColorForEvent(ev, settings, fixedColor) {
        if (!settings.lyricFollowSinger || !ev.singers.length) { return fixedColor; }
        return singerColorForEvent(ev,fixedColor);
    }
    function addGradientRamp(layer,colorA,colorB,time) {
        var fx=layer.property("ADBE Effect Parade").addProperty("ADBE Ramp"),rect;
        try{rect=layer.sourceRectAtTime(time,false);}catch(e){rect={left:-500,top:-50,width:1000,height:100};}
        try{fx.property(1).setValue([rect.left,rect.top+rect.height/2]);}catch(e1){}
        try{fx.property(2).setValue(colorA);}catch(e2){}
        try{fx.property(3).setValue([rect.left+rect.width,rect.top+rect.height/2]);}catch(e3){}
        try{fx.property(4).setValue(colorB);}catch(e4){}
        try{fx.property(1).expression='var r=thisLayer.sourceRectAtTime(time,false);[r.left,r.top+r.height/2];';fx.property(3).expression='var r=thisLayer.sourceRectAtTime(time,false);[r.left+r.width,r.top+r.height/2];';}catch(e5){}
        return fx;
    }
    function addSoftVerticalReveal(layer,height) {
        var fx=layer.property("ADBE Effect Parade").addProperty("ADBE Linear Wipe");
        try{fx.property(1).setValue(50);}catch(e1){}
        try{fx.property(2).setValue(0);}catch(e2){}
        try{fx.property(3).setValue(Math.min(1000,Math.max(40,height)));}catch(e3){}
        return fx;
    }
    function validTaggedActor(actor){var parts=splitSingers(actor),i,j,found;if(!parts.length){return false;}for(i=0;i<parts.length;i++){if(parts[i].toUpperCase()==="ALL"||parts[i].toUpperCase()==="NONE"){continue;}found=false;for(j=0;j<state.characters.length;j++){if(state.characters[j].id===parts[i]){found=true;break;}}if(!found){return false;}}return true;}
    function parseLyricSegments(text,defaultActor){var source=String(text),re=/\[([^\]]+)\]/g,m,cursor=0,current=defaultActor||"NONE",segments=[],display="",found=false,piece;function append(value,actor){if(!value){return;}segments.push({text:value,actor:actor});display+=value;}while((m=re.exec(source))!==null){if(!validTaggedActor(trim(m[1]))){continue;}piece=source.substring(cursor,m.index);append(piece,current);current=trim(m[1]);cursor=re.lastIndex;found=true;}if(!found){return{hasTags:false,text:source,segments:[{text:source,actor:current}]};}append(source.substring(cursor),current);return{hasTags:true,text:display,segments:segments};}
    function taggedActorsFromText(text){var parsed=parseLyricSegments(text,"NONE"),out=[],i,j,parts,p;if(!parsed.hasTags){return "";}for(i=0;i<parsed.segments.length;i++){parts=splitSingers(parsed.segments[i].actor);for(j=0;j<parts.length;j++){p=parts[j];if(p.toUpperCase()==="ALL"){return "ALL";}if(p.toUpperCase()!=="NONE"){uniquePush(out,p);}}}return out.length?out.join("+"):"NONE";}
    function colorsForTaggedActor(actor,fixed){var parts=splitSingers(actor),ids=[],colors=[],i,p;if(parts.length===1&&parts[0].toUpperCase()==="ALL"){for(i=0;i<state.characters.length;i++){ids.push(state.characters[i].id);}}else{for(i=0;i<parts.length;i++){p=parts[i];if(p.toUpperCase()!=="NONE"){ids.push(p);}}}for(i=0;i<ids.length;i++){colors.push(characterColor(ids[i],fixed));}return colors.length?colors:[fixed];}
    function solidRunsForTaggedSegments(parsed,fixed,followSinger){var out=[],i,j,seg,colors,count,start,end;if(!followSinger){return[{text:parsed.text,color:fixed}];}for(i=0;i<parsed.segments.length;i++){seg=parsed.segments[i];colors=colorsForTaggedActor(seg.actor,fixed);if(colors.length===1){out.push({text:seg.text,color:colors[0]});continue;}count=seg.text.length;start=0;for(j=0;j<colors.length;j++){end=j===colors.length-1?count:Math.round(count*(j+1)/colors.length);if(end>start){out.push({text:seg.text.substring(start,end),color:colors[j]});}start=end;}}return out;}
    function createSegmentedLyric(comp,ev,kind,settings,font,size,minSize,fixed,y,count,parsed){var runs=solidRunsForTaggedSegments(parsed,fixed,settings.lyricFollowSinger),layers=[],props=[],widths=[],i,layer,prop,rect,total=0,targetSize=size,fitRatio,left,offset;for(i=0;i<runs.length;i++){layer=comp.layers.addText(runs[i].text);layer.name=AUTO+"LYRIC_"+kind+"_"+pad(count,4)+"_PART_"+pad(i+1,2);layer.inPoint=ev.start;layer.outPoint=Math.min(comp.duration,ev.end);prop=setTextLayer(layer,runs[i].text,{font:font,size:size,color:runs[i].color,stroke:settings.lyricStroke,strokeColor:[0,0,0],strokeWidth:2});addUnifiedDropShadow(layer,"Lyric Shadow",settings.lyricShadowColor,settings.lyricShadowEnabled?settings.lyricShadowOpacity:0,settings.lyricShadowDirection,settings.lyricShadowDistance,settings.lyricShadowSoftness,"Lyric");try{rect=layer.sourceRectAtTime(ev.start,false);widths[i]=Math.max(1,rect.width);}catch(e){widths[i]=runs[i].text.length*size;}total+=widths[i];layers.push(layer);props.push(prop);}if(total>settings.maxLyricWidth){targetSize=Math.max(minSize,size*settings.maxLyricWidth/total*0.98);total=0;for(i=0;i<layers.length;i++){var doc=props[i].value;doc.fontSize=targetSize;props[i].setValue(doc);try{rect=layers[i].sourceRectAtTime(ev.start,false);widths[i]=Math.max(1,rect.width);}catch(e2){widths[i]=runs[i].text.length*targetSize;}total+=widths[i];}}fitRatio=targetSize/size;left=-total/2;for(i=0;i<layers.length;i++){offset=left+widths[i]/2;setLayerPosition(layers[i],[settings.lyricX+offset,y]);addFadeScaleAnimation(layers[i],ev.start,Math.min(comp.duration,ev.end),settings.lyricAnimation,settings.lyricIn,settings.lyricOut);attachLyricMasterControls(layers[i],props[i],kind,fitRatio,offset,size);left+=widths[i];}}
    function buildLyricDisplayEvents(events,style){var out=[],groups={},order=[],i,e,g,j,entry,parts,parsed,segments,text,actors,p;for(i=0;i<events.length;i++){e=events[i];if(e.style!==style||!trim(e.text)){continue;}g=trim(e.group||"");if(!g){out.push(e);continue;}if(!groups[g]){groups[g]={parts:[],start:e.start,end:e.end};order.push(g);}groups[g].parts.push(e);groups[g].start=Math.min(groups[g].start,e.start);groups[g].end=Math.max(groups[g].end,e.end);}for(i=0;i<order.length;i++){entry=groups[order[i]];parts=entry.parts;parts.sort(function(a,b){return a.start-b.start||a.line-b.line;});segments=[];text="";actors=[];for(j=0;j<parts.length;j++){e=parts[j];parsed=parseLyricSegments(e.text,e.actor);if(parsed.hasTags){for(var k=0;k<parsed.segments.length;k++){segments.push(parsed.segments[k]);text+=parsed.segments[k].text;}}else{segments.push({text:e.text,actor:e.actor});text+=e.text;}for(var m=0;m<e.singers.length;m++){p=e.singers[m];if(p.toUpperCase()==="ALL"){actors=["ALL"];break;}if(p.toUpperCase()!=="NONE"&&actors.length&&actors[0]!=="ALL"){uniquePush(actors,p);}else if(p.toUpperCase()!=="NONE"&&!actors.length){actors.push(p);}}}out.push({start:entry.start,end:entry.end,style:style,actor:actors.length?actors.join("+"):"NONE",singers:actors.length?actors:["NONE"],text:text,group:order[i],line:parts[0].line,_lyricSegments:{hasTags:true,text:text,segments:segments}});}out.sort(function(a,b){return a.start-b.start||a.line-b.line;});return out;}
    function createLyricsForStyle(comp, events, style, kind, settings) {
        if (!style || style===NONE_STYLE_LABEL) { return; }
        var font=kind==="MAIN"?settings.mainFont:settings.subFont, size=kind==="MAIN"?settings.mainSize:settings.subSize;
        var minSize=kind==="MAIN"?settings.mainMinSize:settings.subMinSize, fixed=kind==="MAIN"?settings.mainColor:settings.subColor;
        var displayEvents=buildLyricDisplayEvents(events,style),y=kind==="MAIN"?settings.mainY:settings.subY, i,ev,layer,textProp,count=0,color,theme,fitRatio,overlay,overlayProp,overlayDoc,rect,segments;
        for(i=0;i<displayEvents.length;i++){
            ev=displayEvents[i];if(!trim(ev.text)){continue;}count++;
            segments=ev._lyricSegments||parseLyricSegments(ev.text,ev.actor);if(segments.hasTags){createSegmentedLyric(comp,ev,kind,settings,font,size,minSize,fixed,y,count,segments);continue;}
            layer=comp.layers.addText(ev.text); layer.name=AUTO+"LYRIC_"+kind+"_"+pad(count,4);
            layer.inPoint=ev.start; layer.outPoint=Math.min(comp.duration,ev.end);
            theme=settings.lyricFollowSinger?themeForEvent(ev,settings):{colors:[fixed],kind:"fixed"};
            if(theme.kind==="none"){theme={colors:[fixed],kind:"fixed"};}
            color=themeColorAt(theme,0);
            textProp=setTextLayer(layer,ev.text,{font:font,size:size,color:color,stroke:settings.lyricStroke,strokeColor:[0,0,0],strokeWidth:2});
            setLayerPosition(layer,[settings.lyricX,y]); autoFitText(layer,textProp,settings.maxLyricWidth,minSize);
            fitRatio=textProp.value.fontSize/size;
            if(theme.colors.length>1){
                overlay=layer.duplicate();overlay.name=layer.name+"_GRADIENT_B";overlayProp=overlay.property("ADBE Text Properties").property("ADBE Text Document");overlayDoc=overlayProp.value;overlayDoc.fillColor=themeColorAt(theme,1);overlayProp.setValue(overlayDoc);
                try{rect=layer.sourceRectAtTime(ev.start,false);}catch(rectError){rect={height:size};}addSoftVerticalReveal(overlay,rect.height);
                addFadeScaleAnimation(overlay,ev.start,Math.min(comp.duration,ev.end),settings.lyricAnimation,settings.lyricIn,settings.lyricOut);attachLyricMasterControls(overlay,overlayProp,kind,fitRatio);
            }
            addUnifiedDropShadow(layer,"Lyric Shadow",settings.lyricShadowColor,settings.lyricShadowEnabled?settings.lyricShadowOpacity:0,settings.lyricShadowDirection,settings.lyricShadowDistance,settings.lyricShadowSoftness,"Lyric");
            addFadeScaleAnimation(layer,ev.start,Math.min(comp.duration,ev.end),settings.lyricAnimation,settings.lyricIn,settings.lyricOut);
            attachLyricMasterControls(layer,textProp,kind,fitRatio);
        }
    }
    function createBannerSegment(comp,left,right,height,y,name,color,opacity,blur,bottomBlur){
        var width=right-left,extra=0,topBlur=blur||0;bottomBlur=bottomBlur===undefined?topBlur:bottomBlur;var topMargin=topBlur>0?topBlur*2+6:0,bottomMargin=bottomBlur>0?bottomBlur*2+6:0,verticalExtra=topMargin+bottomMargin;
        var layer=comp.layers.addSolid([1,1,1],name,Math.max(2,Math.round(width+extra)),Math.max(2,Math.round(height+verticalExtra)),1,comp.duration);
        setLayerPosition(layer,[(left+right)/2,y+(bottomMargin-topMargin)/2]);setLayerOpacity(layer,opacity);
        var effects=layer.property("ADBE Effect Parade"),ramp=effects.addProperty("ADBE Ramp"),w=width+extra,h=height+verticalExtra;
        ramp.property(1).setValue([extra/2,h/2]);ramp.property(2).setValue(color);ramp.property(3).setValue([extra/2+width,h/2]);ramp.property(4).setValue(color);
        if(topBlur>0||bottomBlur>0){var mask=layer.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"),shape=new Shape(),topContact=topBlur>0?Math.min(topMargin-2,Math.max(4,topBlur*0.65)):0,bottomContact=bottomBlur>0?Math.min(bottomMargin-2,Math.max(4,bottomBlur*0.65)):0;shape.vertices=[[0,topMargin-topContact],[w,topMargin-topContact],[w,topMargin+height+bottomContact],[0,topMargin+height+bottomContact]];shape.closed=true;mask.property("ADBE Mask Shape").setValue(shape);mask.property("ADBE Mask Feather").setValue([0,Math.max(topBlur,bottomBlur)]);}
        return {layer:layer,startColor:ramp.property(2),endColor:ramp.property(4)};
    }
    function animateActiveBannerShadow(layer,intervals,settings,duration){var op=layer.property("ADBE Transform Group").property("ADBE Opacity"),i,a,b,pre,post;op.setValue(0);setKey(op,0,0);for(i=0;i<intervals.length;i++){a=clamp(intervals[i][0],0,duration);b=clamp(intervals[i][1],0,duration);pre=Math.max(0,a-settings.transition);post=Math.min(duration,b+settings.transition);setKey(op,pre,0);setKey(op,a,settings.bannerActiveShadowOpacity);setKey(op,b,settings.bannerActiveShadowOpacity);setKey(op,post,0);}setKey(op,duration,0);setTemporalEase(op);}
    function createBanner(comp,settings,characterFloor,intervals){
        if(settings.layoutMode!=="顶部拼贴"||!settings.bannerEnabled){return;}
        var y=settings.portraitHeight+settings.bannerHeight/2,n=state.characters.length,i,item,spans=[],c0,c1;
        if(n<=1){spans.push([0,settings.width,0,0]);}
        else{
            c0=settings.width/(2*n);spans.push([0,c0,0,0]);
            for(i=0;i<n-1;i++){c0=settings.width*(i+0.5)/n;c1=settings.width*(i+1.5)/n;spans.push([c0,c1,i/(n-1),(i+1)/(n-1)]);}
            c0=settings.width*(n-0.5)/n;spans.push([c0,settings.width,1,1]);
        }
        if(settings.bannerActiveShadowOpacity>0&&settings.bannerActiveShadowSize>0&&n>0){var cellW=settings.width/n,left,right,sampleL,sampleR,charId;for(i=0;i<n;i++){left=i*cellW;right=(i+1)*cellW;sampleL=n<=1?0:left/settings.width;sampleR=n<=1?1:right/settings.width;charId=state.characters[i].id;item=createBannerSegment(comp,left,right,settings.bannerHeight,y,AUTO+"BANNER_ACTIVE_SHADOW_"+safeName(charId),settings.bannerColor,0,settings.bannerActiveShadowSize,0);animateThemeColor(item.startColor,state.ass.events,settings,comp.duration,sampleL,0);animateThemeColor(item.endColor,state.ass.events,settings,comp.duration,sampleR,0);animateActiveBannerShadow(item.layer,intervals[charId]||[],settings,comp.duration);if(characterFloor){item.layer.moveAfter(characterFloor);}}}
        if(settings.bannerShadowOpacity>0&&(settings.bannerShadowSize>0||settings.bannerBottomShadowSize>0)){for(i=0;i<spans.length;i++){item=createBannerSegment(comp,spans[i][0],spans[i][1],settings.bannerHeight,y,AUTO+"BANNER_SHADOW_"+pad(i+1,2),settings.bannerColor,settings.bannerShadowOpacity,settings.bannerShadowSize,settings.bannerBottomShadowSize);animateThemeColor(item.startColor,state.ass.events,settings,comp.duration,spans[i][2],0);animateThemeColor(item.endColor,state.ass.events,settings,comp.duration,spans[i][3],0);if(characterFloor){item.layer.moveAfter(characterFloor);}}}
        for(i=0;i<spans.length;i++){item=createBannerSegment(comp,spans[i][0],spans[i][1],settings.bannerHeight,y,AUTO+"BANNER_BG_"+pad(i+1,2),settings.bannerColor,100,0);animateThemeColor(item.startColor,state.ass.events,settings,comp.duration,spans[i][2],0);animateThemeColor(item.endColor,state.ass.events,settings,comp.duration,spans[i][3],0);if(characterFloor){item.layer.moveAfter(characterFloor);}}
        if(trim(settings.bannerText)){
            var textLayer=comp.layers.addText(settings.bannerText);textLayer.name=AUTO+"BANNER_TEXT";
            setTextLayer(textLayer,settings.bannerText,{font:settings.bannerFont,size:settings.bannerSize,color:settings.bannerTextColor});
            setLayerPosition(textLayer,[settings.width/2,y]);
        }
    }
    function findCompInItem(root,name){var i,item,found;if(!root){return null;}if(root instanceof CompItem&&root.name===name){return root;}if(root instanceof FolderItem){for(i=1;i<=root.numItems;i++){item=root.item(i);if(item instanceof CompItem&&item.name===name){return item;}if(item instanceof FolderItem){found=findCompInItem(item,name);if(found){return found;}}}}return null;}
    function setEffectValue(effect,index,value){try{effect.property(index).setValue(value);}catch(e){}}
    function createBuiltInSpectrum(comp,settings,audioLayer,duration){var layer=comp.layers.addSolid([0,0,0],AUTO+"SPECTRUM",settings.width,settings.height,1,duration),effects=layer.property("ADBE Effect Parade"),spectrum=effects.addProperty("ADBE AudSpect"),half=settings.spectrumWidth/2,startX=settings.spectrumMirror?settings.spectrumX:settings.spectrumX-half,endX=settings.spectrumX+half,minimax,contrast,mirror,startAt=settings.spectrumAfterIntro?firstLyricStart(settings):0;if(!spectrum){throw new Error("当前 AE 无法创建内置“音频频谱”效果。");}spectrum.name=AUTO+"Audio Spectrum";setEffectValue(spectrum,1,audioLayer.index);setEffectValue(spectrum,2,[startX,settings.spectrumY]);setEffectValue(spectrum,3,[endX,settings.spectrumY]);setEffectValue(spectrum,6,settings.spectrumStartFreq);setEffectValue(spectrum,7,settings.spectrumEndFreq);setEffectValue(spectrum,8,settings.spectrumBands);setEffectValue(spectrum,9,settings.spectrumMaxHeight);setEffectValue(spectrum,10,settings.spectrumDurationMs);setEffectValue(spectrum,11,0);setEffectValue(spectrum,12,settings.spectrumThickness);setEffectValue(spectrum,13,settings.spectrumSoftness);setEffectValue(spectrum,14,settings.spectrumColor);setEffectValue(spectrum,15,settings.spectrumColor);setEffectValue(spectrum,16,0);setEffectValue(spectrum,17,0);setEffectValue(spectrum,18,1);setEffectValue(spectrum,19,1);setEffectValue(spectrum,20,1);setEffectValue(spectrum,21,settings.spectrumSide==="上下双向"?3:1);setEffectValue(spectrum,22,0);setEffectValue(spectrum,23,0);if(settings.spectrumMinimax>0){try{minimax=effects.addProperty("ADBE Minimax");minimax.name=AUTO+"Minimax";setEffectValue(minimax,1,1);setEffectValue(minimax,2,settings.spectrumMinimax);}catch(minimaxError){}}try{contrast=effects.addProperty("ADBE Brightness & Contrast 2");contrast.name=AUTO+"Brightness Contrast";setEffectValue(contrast,1,0);setEffectValue(contrast,2,settings.spectrumContrast);}catch(contrastError){}if(settings.spectrumMirror){try{mirror=effects.addProperty("ADBE Mirror");mirror.name=AUTO+"Mirror";setEffectValue(mirror,1,[settings.spectrumX,settings.spectrumY]);setEffectValue(mirror,2,180);}catch(mirrorError){}}layer.inPoint=startAt;layer.outPoint=duration;try{layer.audioEnabled=false;}catch(audioError){}return layer;}
    function importSpectrum(comp,folder,settings,audioLayer,duration){if(!settings.spectrumEnabled){return null;}if(!audioLayer){throw new Error("启用频谱时必须选择音乐文件。");}if(settings.spectrumMode==="内置频谱"){return createBuiltInSpectrum(comp,settings,audioLayer,duration);}var opts=new ImportOptions(settings.spectrumFile),root,tpl,placeholder,layer,startAt=settings.spectrumAfterIntro?firstLyricStart(settings):0;try{if(opts.canImportAs(ImportAsType.PROJECT)){opts.importAs=ImportAsType.PROJECT;}}catch(e){}root=app.project.importFile(opts);try{root.parentFolder=folder;}catch(parentError){}tpl=findCompInItem(root,settings.spectrumCompName);if(!tpl){throw new Error("频谱模板中找不到合成："+settings.spectrumCompName);}try{placeholder=tpl.layer(settings.spectrumAudioLayer);}catch(layerError){placeholder=null;}if(!placeholder){throw new Error("频谱合成中找不到音频占位层："+settings.spectrumAudioLayer);}try{placeholder.replaceSource(audioLayer.source,false);}catch(replaceError){throw new Error("无法替换频谱音频占位层，请确认它是可替换素材层。\r"+replaceError.toString());}tpl.duration=duration;placeholder.startTime=0;placeholder.inPoint=0;placeholder.outPoint=duration;layer=comp.layers.add(tpl);layer.name=AUTO+"SPECTRUM";setLayerPosition(layer,[settings.spectrumX,settings.spectrumY]);layer.property("ADBE Transform Group").property("ADBE Scale").setValue([settings.spectrumScale,settings.spectrumScale]);layer.inPoint=startAt;layer.outPoint=duration;try{layer.audioEnabled=false;}catch(audioError){}return layer;}
    function firstLyricStart(settings){var first=null,i,e;for(i=0;i<state.ass.events.length;i++){e=state.ass.events[i];if(e.style===settings.mainStyle&&trim(e.text)){first=first===null?e.start:Math.min(first,e.start);}}return first===null?0:first;}
    function fadeOutAt(layer,end){if(end<=0){return;}var op=layer.property("ADBE Transform Group").property("ADBE Opacity"),fade=Math.min(0.35,end);layer.inPoint=0;layer.outPoint=end;setKey(op,0,100);setKey(op,Math.max(0,end-fade),100);setKey(op,end,0);setTemporalEase(op);}
    function createTitleBlock(comp,folder,settings,end,prefix){var titleLayer=null,logoLayer=null,infoLayer=null,item,scale,prop,mode=settings.coverTitleMode||"文字标题",showLogo=mode!=="文字标题"&&settings.coverLogoFile&&settings.coverLogoFile.exists,showText=mode!=="Logo"||!showLogo,titleY=settings.coverTitleY;if(showLogo){item=importFootage(settings.coverLogoFile,folder);logoLayer=comp.layers.add(item);logoLayer.name=AUTO+prefix+"_LOGO";scale=Math.min(1,settings.coverLogoWidth/item.width)*100;logoLayer.property("ADBE Transform Group").property("ADBE Scale").setValue([scale,scale]);setLayerPosition(logoLayer,[settings.width/2,mode==="Logo + 文字"?titleY-60:titleY]);}if(showText&&trim(settings.songTitle)){titleLayer=comp.layers.addText(settings.songTitle);titleLayer.name=AUTO+prefix+"_TITLE";setTextLayer(titleLayer,settings.songTitle,{font:settings.songTitleFont,size:settings.songTitleSize,color:settings.songTitleColor});setLayerPosition(titleLayer,[settings.width/2,mode==="Logo + 文字"?titleY+100:titleY]);if(settings.songTitleGlow>0){addGlow(titleLayer,settings.songTitleColor,settings.songTitleGlow,settings.songTitleGlowRadius);}}if(trim(settings.coverInfo)){infoLayer=comp.layers.addText(settings.coverInfo);infoLayer.name=AUTO+prefix+"_INFO";prop=setTextLayer(infoLayer,settings.coverInfo,{font:settings.coverInfoFont,size:settings.coverInfoSize,color:settings.coverInfoColor});setLayerPosition(infoLayer,[settings.width/2,settings.coverInfoY]);autoFitText(infoLayer,prop,settings.maxLyricWidth,12);}if(end!==null){if(logoLayer){fadeOutAt(logoLayer,end);}if(titleLayer){fadeOutAt(titleLayer,end);}if(infoLayer){fadeOutAt(infoLayer,end);}}return{title:titleLayer,logo:logoLayer,info:infoLayer};}
    function coverTheme(settings){var ids=[],i;for(i=0;i<state.characters.length;i++){ids.push(state.characters[i].id);}return{colors:colorsForMode(settings.allColorMode,ids,settings.allColorA,settings.allColorB,settings.bannerColor),kind:"all"};}
    function createCoverBanner(comp,settings){if(settings.layoutMode!=="顶部拼贴"||!settings.bannerEnabled){return;}var y=settings.portraitHeight+settings.bannerHeight/2,n=state.characters.length,theme=coverTheme(settings),spans=[],i,c0,c1,item;if(n<=1){spans.push([0,settings.width,0,1]);}else{c0=settings.width/(2*n);spans.push([0,c0,0,0]);for(i=0;i<n-1;i++){c0=settings.width*(i+0.5)/n;c1=settings.width*(i+1.5)/n;spans.push([c0,c1,i/(n-1),(i+1)/(n-1)]);}c0=settings.width*(n-0.5)/n;spans.push([c0,settings.width,1,1]);}for(i=0;i<spans.length;i++){item=createBannerSegment(comp,spans[i][0],spans[i][1],settings.bannerHeight,y,AUTO+"COVER_BANNER_SHADOW_"+pad(i+1,2),settings.bannerColor,Math.max(settings.bannerShadowOpacity,settings.bannerActiveShadowOpacity),Math.max(settings.bannerShadowSize,settings.bannerActiveShadowSize),settings.bannerBottomShadowSize);item.startColor.setValue(themeColorAt(theme,spans[i][2]));item.endColor.setValue(themeColorAt(theme,spans[i][3]));}for(i=0;i<spans.length;i++){item=createBannerSegment(comp,spans[i][0],spans[i][1],settings.bannerHeight,y,AUTO+"COVER_BANNER_BG_"+pad(i+1,2),settings.bannerColor,100,0);item.startColor.setValue(themeColorAt(theme,spans[i][2]));item.endColor.setValue(themeColorAt(theme,spans[i][3]));}if(trim(settings.bannerText)){var textLayer=comp.layers.addText(settings.bannerText);textLayer.name=AUTO+"COVER_BANNER_TEXT";setTextLayer(textLayer,settings.bannerText,{font:settings.bannerFont,size:settings.bannerSize,color:settings.bannerTextColor});setLayerPosition(textLayer,[settings.width/2,y]);}}
    function copyObject(source){var out={},k;for(k in source){if(source.hasOwnProperty(k)){out[k]=source[k];}}return out;}
    function createCoverComposition(folder,settings){if(!settings.coverEnabled){return null;}var cover=app.project.items.addComp(settings.compName+"_Cover",settings.width,settings.height,1,settings.coverDuration,settings.fps);cover.parentFolder=folder;createBackground(cover,folder,settings);var cs=copyObject(settings);cs.showNames=true;var positions=cs.layoutMode==="顶部拼贴"?calculateTopStripLayout(state.characters.length,cs.width,cs.portraitHeight):calculateLayout(state.characters.length,cs.layoutX,cs.layoutY,cs.charSize,cs.charGap,cs.maxLayoutWidth),names=[],allInterval=[[0,settings.coverDuration]],i;for(i=0;i<state.characters.length;i++){createCharacter(cover,folder,state.characters[i],positions[i],allInterval,cs,settings.coverDuration,i,names);}createCoverBanner(cover,cs);for(i=0;i<names.length;i++){names[i].moveToBeginning();}createTitleBlock(cover,folder,settings,null,"COVER");return cover;}
    function generate() {
        var settings=collectSettings(), errors=validate(settings), i;
        if(errors.length){alert("生成前检查未通过：\r\r"+errors.join("\r\r"),APP_NAME);return;}
        app.beginUndoGroup(APP_NAME+" Generate");
        try{
            ensureProject();
            var lastEnd=0; for(i=0;i<state.ass.events.length;i++){lastEnd=Math.max(lastEnd,state.ass.events[i].end);}
            var duration=Math.max(1,lastEnd+1), audioProbe=null;
            if(fileExists(state.audioFile)){
                audioProbe=importFootage(state.audioFile,null); if(audioProbe.duration&&isFinite(audioProbe.duration)){duration=audioProbe.duration;}
                try{audioProbe.remove();}catch(removeError){}
            }
            var folder=app.project.items.addFolder(AUTO+safeName(settings.compName)+"_"+(new Date().getTime()));
            var comp=app.project.items.addComp(settings.compName,settings.width,settings.height,1,duration,settings.fps); comp.parentFolder=folder;
            createBackground(comp,folder,settings); var audioLayer=createAudio(comp,folder);importSpectrum(comp,folder,settings,audioLayer,duration);
            var master=createMasterControls(comp,settings);
            var intervals=buildSingerIntervals(state.ass.events,state.characters,1/settings.fps),characterLayers=[],nameLayers=[];
            var positions=settings.layoutMode==="顶部拼贴"?calculateTopStripLayout(state.characters.length,settings.width,settings.portraitHeight):calculateLayout(state.characters.length,settings.layoutX,settings.layoutY,settings.charSize,settings.charGap,settings.maxLayoutWidth);
            for(i=0;i<state.characters.length;i++){characterLayers.push(createCharacter(comp,folder,state.characters[i],positions[i],intervals[state.characters[i].id],settings,duration,i,nameLayers));}
            createBanner(comp,settings,null,intervals);for(i=0;i<nameLayers.length;i++){nameLayers[i].moveToBeginning();}
            createLyricsForStyle(comp,state.ass.events,settings.mainStyle,"MAIN",settings);
            createLyricsForStyle(comp,state.ass.events,settings.subStyle,"SUB",settings);
            var introEnd=firstLyricStart(settings);if(settings.introEnabled&&introEnd>0){createTitleBlock(comp,folder,settings,introEnd,"INTRO");}
            createCoverComposition(folder,settings);
            writeProjectMetadata(comp);
            master.control.moveToBeginning();master.mainFont.moveAfter(master.control);master.subFont.moveAfter(master.mainFont);
            comp.openInViewer();
            alert("生成完成。\r\r合成："+comp.name+"\r时长："+duration.toFixed(2)+" 秒\r角色："+state.characters.length+" 人",APP_NAME);
        }catch(e){alert("生成失败：\r"+e.toString()+(e.line?"\r行号："+e.line:""),APP_NAME);}
        finally{app.endUndoGroup();}
    }

    // ---------- UI builder ----------
    function buildUI(owner) {
        var win=(owner instanceof Panel)?owner:new Window("palette",APP_NAME+"  v"+VERSION,undefined,{resizeable:true});
        win.orientation="column"; win.alignChildren=["fill","fill"]; win.spacing=8; win.margins=10;
        var tabs=win.add("tabbedpanel"); tabs.alignChildren=["fill","fill"]; tabs.preferredSize=[760,540];
        var projectTab=tabs.add("tab",undefined,"项目"),annotationTab=tabs.add("tab",undefined,"字幕标注"),charTab=tabs.add("tab",undefined,"角色"),layoutTab=tabs.add("tab",undefined,"布局"),lyricTab=tabs.add("tab",undefined,"歌词"),colorTab=tabs.add("tab",undefined,"合唱颜色"),mediaTab=tabs.add("tab",undefined,"封面/频谱");
        var allTabs=[projectTab,annotationTab,charTab,layoutTab,lyricTab,colorTab,mediaTab],tabIndex;for(tabIndex=0;tabIndex<allTabs.length;tabIndex++){allTabs[tabIndex].orientation="column";allTabs[tabIndex].alignChildren=["fill","top"];}
        var u=state.ui;

        var files=projectTab.add("panel",undefined,"输入文件"); files.orientation="column"; files.alignChildren=["fill","center"];
        u.assPath=addFileRow(files,"ASS 字幕",function(){var f=browseFile("选择 ASS 字幕","ASS:*.ass");if(f){state.assFile=f;u.assPath.text=f.fsName;}});
        u.audioPath=addFileRow(files,"歌曲",function(){var f=browseFile("选择歌曲","Audio:*.wav;*.mp3;*.m4a;*.aac;*.aif;*.aiff;*.flac");if(f){state.audioFile=f;u.audioPath.text=f.fsName;}});
        u.bgPath=addFileRow(files,"背景",function(){var f=browseFile("选择背景图片","Image:*.png;*.jpg;*.jpeg;*.tif;*.tiff;*.psd");if(f){state.bgFile=f;u.bgPath.text=f.fsName;}});
        var readBtn=files.add("button",undefined,"读取 ASS 并识别角色"); readBtn.onClick=readASSFromUI;
        var compP=projectTab.add("panel",undefined,"合成"); compP.orientation="column"; compP.alignChildren=["left","center"];
        u.compName=addLabeledEdit(compP,"合成名称","Lyrics Distribution",28);
        var dims=compP.add("group"); dims.add("statictext",undefined,"宽");u.width=dims.add("edittext",undefined,"1920");u.width.characters=7;dims.add("statictext",undefined,"高");u.height=dims.add("edittext",undefined,"1080");u.height.characters=7;dims.add("statictext",undefined,"FPS");u.fps=dims.add("edittext",undefined,"30");u.fps.characters=6;
        var bgG=compP.add("group");bgG.add("statictext",undefined,"无背景图片时纯色");u.bgColor=bgG.add("edittext",undefined,"#FFFFFF");u.bgColor.characters=9;var bgPick=bgG.add("button",undefined,"选色");bgPick.onClick=function(){chooseColor(u.bgColor);};

        var annFiles=annotationTab.add("panel",undefined,"字幕与当前项目角色");annFiles.orientation="column";annFiles.alignChildren=["fill","center"];
        var annFileG=annFiles.add("group");annFileG.add("statictext",undefined,"SRT / LRC");u.annotationPath=annFileG.add("edittext",undefined,"");u.annotationPath.characters=48;u.annotationPath.enabled=false;var annBrowse=annFileG.add("button",undefined,"导入");annBrowse.onClick=importAnnotationFile;
        var annRoleG=annFiles.add("group");annRoleG.add("statictext",undefined,"当前角色");u.annotationRoleSummary=annRoleG.add("edittext",undefined,"请先在“角色”页创建或添加角色");u.annotationRoleSummary.characters=48;u.annotationRoleSummary.enabled=false;var annRolesApply=annRoleG.add("button",undefined,"刷新");annRolesApply.onClick=syncProjectRolesUI;
        var annBody=annotationTab.add("group");annBody.orientation="row";annBody.alignChildren=["fill","fill"];
        u.annotationList=annBody.add("listbox",undefined,[],{multiselect:false});u.annotationList.preferredSize=[330,340];
        var annEdit=annBody.add("panel",undefined,"当前字幕");annEdit.orientation="column";annEdit.alignChildren=["fill","top"];annEdit.preferredSize.width=360;
        var segmentHint=annEdit.add("statictext",undefined,"分段颜色示例：[A]前半句[B+C]后半句");segmentHint.helpTip="方括号内填写角色 Actor ID；各段按角色使用清晰色块，不会把整句拉成渐变。";
        var annTime=annEdit.add("group");annTime.add("statictext",undefined,"开始");u.annotationStart=annTime.add("edittext",undefined,"");u.annotationStart.characters=10;annTime.add("statictext",undefined,"结束");u.annotationEnd=annTime.add("edittext",undefined,"");u.annotationEnd.characters=10;
        var annGroupRow=annEdit.add("group");annGroupRow.add("statictext",undefined,"同一行组");u.annotationGroup=annGroupRow.add("edittext",undefined,"");u.annotationGroup.characters=10;var newGroupBtn=annGroupRow.add("button",undefined,"新组");newGroupBtn.onClick=startNewLineGroup;var previousGroupBtn=annGroupRow.add("button",undefined,"同上一条");previousGroupBtn.onClick=groupWithPrevious;
        var annMain=annEdit.add("group");annMain.add("statictext",undefined,"主歌词").preferredSize.width=48;u.annotationMain=annMain.add("edittext",undefined,"",{multiline:true});u.annotationMain.preferredSize=[285,52];
        var annSub=annEdit.add("group");annSub.add("statictext",undefined,"副歌词").preferredSize.width=48;u.annotationSub=annSub.add("edittext",undefined,"",{multiline:true});u.annotationSub.preferredSize=[285,45];
        var annActorRow=annEdit.add("group");annActorRow.add("statictext",undefined,"Actor");u.annotationActor=annActorRow.add("edittext",undefined,"");u.annotationActor.characters=28;u.annotationActor.onChange=function(){syncAnnotationChecks(u.annotationActor.text);};
        u.annotationChecksPanel=annEdit.add("panel",undefined,"演唱角色（可多选）");u.annotationChecksPanel.orientation="row";u.annotationChecksPanel.alignChildren=["left","top"];u.annotationChecksPanel.preferredSize=[335,70];
        var annQuickButtons=annEdit.add("group");var annNone=annQuickButtons.add("button",undefined,"清空（NONE）");annNone.onClick=function(){setAnnotationActor("NONE");};var annAll=annQuickButtons.add("button",undefined,"全选（ALL）");annAll.onClick=function(){setAnnotationActor("ALL");};
        var annEditButtons=annEdit.add("group");var annSet=annEditButtons.add("button",undefined,"保存修改");annSet.onClick=function(){if(annotationSaveCurrent(true)){refreshAnnotationList(state.annotationSelected);}};var annAdd=annEditButtons.add("button",undefined,"新增字幕");annAdd.onClick=addAnnotationCue;var annDelete=annEditButtons.add("button",undefined,"删除当前");annDelete.onClick=deleteAnnotationCue;
        var annSplitButtons=annEdit.add("group");var annPreview=annSplitButtons.add("button",undefined,"AE 预听");annPreview.onClick=previewCurrentAnnotation;var annRecordTime=annSplitButtons.add("button",undefined,"记录当前时间");annRecordTime.onClick=recordCurrentCutTime;var annSplit=annSplitButtons.add("button",undefined,"字符切分");annSplit.onClick=splitCurrentAnnotation;
        u.annotationList.onChange=function(){var next=u.annotationList.selection?u.annotationList.selection.index:-1;annotationSaveCurrent(false);if(next>=0){loadAnnotationCue(next);}};
        refreshActorChecks();
        var annActions=annotationTab.add("group");annActions.alignment="center";var annLoad=annActions.add("button",undefined,"应用标注并载入项目");annLoad.onClick=applyAnnotationToProject;var annExport=annActions.add("button",undefined,"导出 ASS");annExport.onClick=exportAnnotationASS;

        var roleCreate=charTab.add("panel",undefined,"角色库与当前项目");roleCreate.orientation="row";roleCreate.alignChildren=["left","center"];roleCreate.add("statictext",undefined,"新 Actor ID");u.newActorId=roleCreate.add("edittext",undefined,"");u.newActorId.characters=14;var newActorBtn=roleCreate.add("button",undefined,"新建并加入");newActorBtn.onClick=createProjectCharacter;roleCreate.add("statictext",undefined,"已保存角色");u.rolePresetDrop=roleCreate.add("dropdownlist",undefined,[]);u.rolePresetDrop.preferredSize.width=140;var addPresetBtn=roleCreate.add("button",undefined,"加入项目");addPresetBtn.onClick=addPresetCharacter;
        var listG=charTab.add("group"); listG.orientation="row"; listG.alignChildren=["fill","fill"];
        var left=listG.add("panel",undefined,"角色顺序"); left.orientation="column";left.alignChildren=["fill","top"];left.preferredSize.width=210;
        u.charList=left.add("listbox",undefined,[],{multiselect:false});u.charList.preferredSize=[190,260];
        var order=left.add("group");var up=order.add("button",undefined,"↑");var down=order.add("button",undefined,"↓");var removeActorBtn=order.add("button",undefined,"移除");removeActorBtn.onClick=removeProjectCharacter;var savePresetBtn=left.add("button",undefined,"永久保存角色样式");savePresetBtn.onClick=saveCharacterPresets;
        var editor=listG.add("panel",undefined,"选中角色配置");editor.orientation="column";editor.alignChildren=["fill","top"];
        u.charActor=addLabeledEdit(editor,"Actor ID","-",24);u.charActor.enabled=false;
        u.charName=addLabeledEdit(editor,"显示名称","",24);
        u.charSecondary=addLabeledEdit(editor,"第二行名称","",24);u.charSecondary.helpTip="可填写 CV 名、罗马音名或其他副名称";
        var imgG=editor.add("group");imgG.add("statictext",undefined,"角色图片").preferredSize.width=100;u.charImage=imgG.add("edittext",undefined,"");u.charImage.characters=25;u.charImage.enabled=false;var imgBtn=imgG.add("button",undefined,"选择");
        var colG=editor.add("group");colG.add("statictext",undefined,"主题颜色").preferredSize.width=100;u.charColor=colG.add("edittext",undefined,"#FFFFFF");u.charColor.characters=10;var colBtn=colG.add("button",undefined,"选色");
        u.charScale=addLabeledEdit(editor,"图片缩放 %","100",10);u.charX=addLabeledEdit(editor,"Offset X","0",10);u.charY=addLabeledEdit(editor,"Offset Y","0",10);
        editor.add("statictext",undefined,"顶部拼贴使用 Fill 裁切，Scale/Offset 调整取景；卡片横排使用 Fit。",{multiline:true}).preferredSize.width=400;
        u.charList.onChange=function(){saveCharacterEditor();if(u.charList.selection){loadCharacterEditor(u.charList.selection.index);}};
        imgBtn.onClick=function(){if(state.selectedCharacter<0){return;}var f=browseFile("选择角色图片","Image:*.png;*.jpg;*.jpeg;*.tif;*.tiff;*.psd");if(f){state.characters[state.selectedCharacter].imageFile=f;u.charImage.text=f.fsName;}};
        colBtn.onClick=function(){chooseColor(u.charColor);};
        up.onClick=function(){saveCharacterEditor();var i=state.selectedCharacter;if(i>0){var t=state.characters[i-1];state.characters[i-1]=state.characters[i];state.characters[i]=t;refreshCharacterList(i-1);syncProjectRolesUI();}};
        down.onClick=function(){saveCharacterEditor();var i=state.selectedCharacter;if(i>=0&&i<state.characters.length-1){var t=state.characters[i+1];state.characters[i+1]=state.characters[i];state.characters[i]=t;refreshCharacterList(i+1);syncProjectRolesUI();}};

        var layoutP=layoutTab.add("panel",undefined,"布局与角色效果");layoutP.orientation="column";layoutP.alignChildren=["left","center"];
        var modeG=layoutP.add("group");modeG.add("statictext",undefined,"布局模式");u.layoutMode=modeG.add("dropdownlist",undefined,["顶部拼贴","卡片横排"]);u.layoutMode.selection=0;modeG.add("statictext",undefined,"拼贴高度");u.portraitHeight=modeG.add("edittext",undefined,"540");u.portraitHeight.characters=6;u.showNames=modeG.add("checkbox",undefined,"演唱时显示角色名");u.showNames.value=true;
        var nameG=layoutP.add("group");nameG.add("statictext",undefined,"角色名字体");u.nameFont=nameG.add("edittext",undefined,"Arial-BoldMT");u.nameFont.characters=16;var nameFontPick=nameG.add("button",undefined,"选择字体");nameFontPick.onClick=function(){chooseFont(u.nameFont);};nameG.add("statictext",undefined,"第一行字号");u.nameSize=nameG.add("edittext",undefined,"52");u.nameSize.characters=4;nameG.add("statictext",undefined,"第二行");u.nameSecondSize=nameG.add("edittext",undefined,"30");u.nameSecondSize.characters=4;nameG.add("statictext",undefined,"描边色");u.nameStrokeColor=nameG.add("edittext",undefined,"#FFFFFF");u.nameStrokeColor.characters=8;var nameStrokePick=nameG.add("button",undefined,"选色");nameStrokePick.onClick=function(){chooseColor(u.nameStrokeColor);};nameG.add("statictext",undefined,"描边宽");u.nameStrokeWidth=nameG.add("edittext",undefined,"5");u.nameStrokeWidth.characters=4;
        var nameShadowG=layoutP.add("group");u.nameShadowEnabled=nameShadowG.add("checkbox",undefined,"角色名阴影");u.nameShadowEnabled.value=true;nameShadowG.add("statictext",undefined,"颜色");u.nameShadowColor=nameShadowG.add("edittext",undefined,"#000000");u.nameShadowColor.characters=8;var nameShadowPick=nameShadowG.add("button",undefined,"选色");nameShadowPick.onClick=function(){chooseColor(u.nameShadowColor);};nameShadowG.add("statictext",undefined,"透明度");u.nameShadowOpacity=nameShadowG.add("edittext",undefined,"55");u.nameShadowOpacity.characters=4;nameShadowG.add("statictext",undefined,"方向");u.nameShadowDirection=nameShadowG.add("edittext",undefined,"135");u.nameShadowDirection.characters=4;nameShadowG.add("statictext",undefined,"距离");u.nameShadowDistance=nameShadowG.add("edittext",undefined,"5");u.nameShadowDistance.characters=4;nameShadowG.add("statictext",undefined,"柔和度");u.nameShadowSoftness=nameShadowG.add("edittext",undefined,"14");u.nameShadowSoftness.characters=4;
        var lg1=layoutP.add("group");lg1.add("statictext",undefined,"中心 X");u.layoutX=lg1.add("edittext",undefined,"960");u.layoutX.characters=6;lg1.add("statictext",undefined,"Y");u.layoutY=lg1.add("edittext",undefined,"560");u.layoutY.characters=6;lg1.add("statictext",undefined,"角色尺寸");u.charSize=lg1.add("edittext",undefined,"260");u.charSize.characters=6;lg1.add("statictext",undefined,"间距");u.charGap=lg1.add("edittext",undefined,"40");u.charGap.characters=5;
        var lg2=layoutP.add("group");lg2.add("statictext",undefined,"最大总宽");u.maxLayoutWidth=lg2.add("edittext",undefined,"1700");u.maxLayoutWidth.characters=6;lg2.add("statictext",undefined,"未唱透明度");u.inactiveOpacity=lg2.add("edittext",undefined,"100");u.inactiveOpacity.characters=5;lg2.add("statictext",undefined,"演唱缩放 %");u.activeScale=lg2.add("edittext",undefined,"100");u.activeScale.characters=5;lg2.add("statictext",undefined,"切换秒");u.transition=lg2.add("edittext",undefined,"0.12");u.transition.characters=5;
        var tintG=layoutP.add("group");u.inactiveTint=tintG.add("checkbox",undefined,"未唱角色跟随当前演唱者色");u.inactiveTint.value=true;tintG.add("statictext",undefined,"暗化强度 %");u.inactiveTintAmount=tintG.add("edittext",undefined,"90");u.inactiveTintAmount.characters=5;tintG.add("statictext",undefined,"亮部亮度 %");u.inactiveLightFactor=tintG.add("edittext",undefined,"58");u.inactiveLightFactor.characters=5;tintG.add("statictext",undefined,"灰化 %");u.inactiveGrayAmount=tintG.add("edittext",undefined,"65");u.inactiveGrayAmount.characters=5;
        var shadowG=layoutP.add("group");shadowG.add("statictext",undefined,"常态阴影 %");u.bannerGlow=shadowG.add("edittext",undefined,"82");u.bannerGlow.characters=4;shadowG.add("statictext",undefined,"上方范围");u.bannerGlowRadius=shadowG.add("edittext",undefined,"100");u.bannerGlowRadius.characters=4;shadowG.add("statictext",undefined,"下方范围");u.bannerBottomGlowRadius=shadowG.add("edittext",undefined,"65");u.bannerBottomGlowRadius.characters=4;
        var activeShadowG=layoutP.add("group");activeShadowG.add("statictext",undefined,"当前演唱者上阴影 %");u.bannerActiveGlow=activeShadowG.add("edittext",undefined,"88");u.bannerActiveGlow.characters=4;activeShadowG.add("statictext",undefined,"上方范围");u.bannerActiveGlowRadius=activeShadowG.add("edittext",undefined,"190");u.bannerActiveGlowRadius.characters=4;activeShadowG.add("statictext",undefined,"只影响当前演唱角色，下方不放大");
        var bannerG1=layoutP.add("group");u.bannerEnabled=bannerG1.add("checkbox",undefined,"标题色带");u.bannerEnabled.value=true;bannerG1.add("statictext",undefined,"文字上下留白");u.bannerHeight=bannerG1.add("edittext",undefined,"10");u.bannerHeight.characters=5;bannerG1.add("statictext",undefined,"底色");u.bannerColor=bannerG1.add("edittext",undefined,"#F6BBD5");u.bannerColor.characters=8;var bannerPick=bannerG1.add("button",undefined,"选色");bannerPick.onClick=function(){chooseColor(u.bannerColor);};
        var bannerG2=layoutP.add("group");bannerG2.add("statictext",undefined,"中间标题（水印）");u.bannerText=bannerG2.add("edittext",undefined,"AI cover");u.bannerText.characters=20;bannerG2.add("statictext",undefined,"字体");u.bannerFont=bannerG2.add("edittext",undefined,"YuMincho-Regular");u.bannerFont.characters=14;var bannerFontPick=bannerG2.add("button",undefined,"选择字体");bannerFontPick.onClick=function(){chooseFont(u.bannerFont);};bannerG2.add("statictext",undefined,"字号");u.bannerSize=bannerG2.add("edittext",undefined,"42");u.bannerSize.characters=4;u.bannerTextColor=bannerG2.add("edittext",undefined,"#FFFFFF");u.bannerTextColor.characters=8;
        var colorP=colorTab.add("panel",undefined,"统一主题颜色（歌词 / 标题条 / 未唱人物）");colorP.orientation="column";colorP.alignChildren=["left","center"];
        colorP.add("statictext",undefined,"角色颜色渐变：自动使用 ASS Actor 中各角色的主题色；自定义渐变：使用 A→B；固定颜色：使用 A。",{multiline:true}).preferredSize.width=740;
        var bannerG3=colorP.add("group");bannerG3.add("statictext",undefined,"多人合唱");u.multiColorMode=bannerG3.add("dropdownlist",undefined,["角色颜色渐变","自定义渐变","固定颜色"]);u.multiColorMode.selection=0;bannerG3.add("statictext",undefined,"颜色 A");u.multiColorA=bannerG3.add("edittext",undefined,"#86AFFF");u.multiColorA.characters=8;var multiAPick=bannerG3.add("button",undefined,"选色");multiAPick.onClick=function(){chooseColor(u.multiColorA);};bannerG3.add("statictext",undefined,"B");u.multiColorB=bannerG3.add("edittext",undefined,"#FF7070");u.multiColorB.characters=8;var multiBPick=bannerG3.add("button",undefined,"选色");multiBPick.onClick=function(){chooseColor(u.multiColorB);};
        var bannerG4=colorP.add("group");bannerG4.add("statictext",undefined,"ALL 合唱");u.allColorMode=bannerG4.add("dropdownlist",undefined,["角色颜色渐变","自定义渐变","固定颜色"]);u.allColorMode.selection=0;bannerG4.add("statictext",undefined,"颜色 A");u.allColorA=bannerG4.add("edittext",undefined,"#F6BBD5");u.allColorA.characters=8;var allAPick=bannerG4.add("button",undefined,"选色");allAPick.onClick=function(){chooseColor(u.allColorA);};bannerG4.add("statictext",undefined,"B");u.allColorB=bannerG4.add("edittext",undefined,"#86AFFF");u.allColorB.characters=8;var allBPick=bannerG4.add("button",undefined,"选色");allBPick.onClick=function(){chooseColor(u.allColorB);};

        var lyricP=lyricTab.add("panel",undefined,"歌词");lyricP.orientation="column";lyricP.alignChildren=["left","center"];
        var sg=lyricP.add("group");sg.add("statictext",undefined,"主 Style");u.mainStyle=sg.add("dropdownlist",undefined,[]);u.mainStyle.preferredSize.width=120;sg.add("statictext",undefined,"副 Style");u.subStyle=sg.add("dropdownlist",undefined,[NONE_STYLE_LABEL]);u.subStyle.selection=0;u.subStyle.preferredSize.width=120;sg.add("statictext",undefined,"X");u.lyricX=sg.add("edittext",undefined,"960");u.lyricX.characters=6;sg.add("statictext",undefined,"最大宽");u.maxLyricWidth=sg.add("edittext",undefined,"1500");u.maxLyricWidth.characters=6;
        var mainG=lyricP.add("group");mainG.add("statictext",undefined,"主歌词 字体");u.mainFont=mainG.add("edittext",undefined,"YuMincho-Regular");u.mainFont.characters=15;var mainFontPick=mainG.add("button",undefined,"选择字体");mainFontPick.onClick=function(){chooseFont(u.mainFont);};mainG.add("statictext",undefined,"字号");u.mainSize=mainG.add("edittext",undefined,"64");u.mainSize.characters=4;mainG.add("statictext",undefined,"最小");u.mainMinSize=mainG.add("edittext",undefined,"28");u.mainMinSize.characters=4;mainG.add("statictext",undefined,"Y");u.mainY=mainG.add("edittext",undefined,"800");u.mainY.characters=5;u.mainColor=mainG.add("edittext",undefined,"#E8A7C4");u.mainColor.characters=8;var mainPick=mainG.add("button",undefined,"选色");mainPick.onClick=function(){chooseColor(u.mainColor);};
        var subG=lyricP.add("group");subG.add("statictext",undefined,"副歌词 字体");u.subFont=subG.add("edittext",undefined,"MicrosoftYaHei");u.subFont.characters=15;var subFontPick=subG.add("button",undefined,"选择字体");subFontPick.onClick=function(){chooseFont(u.subFont);};subG.add("statictext",undefined,"字号");u.subSize=subG.add("edittext",undefined,"48");u.subSize.characters=4;subG.add("statictext",undefined,"最小");u.subMinSize=subG.add("edittext",undefined,"22");u.subMinSize.characters=4;subG.add("statictext",undefined,"Y");u.subY=subG.add("edittext",undefined,"920");u.subY.characters=5;u.subColor=subG.add("edittext",undefined,"#E8A7C4");u.subColor.characters=8;var subPick=subG.add("button",undefined,"选色");subPick.onClick=function(){chooseColor(u.subColor);};
        var animG=lyricP.add("group");animG.add("statictext",undefined,"动画");u.lyricAnimation=animG.add("dropdownlist",undefined,["Scale + Fade","淡入淡出","无动画"]);u.lyricAnimation.selection=0;animG.add("statictext",undefined,"入场秒");u.lyricIn=animG.add("edittext",undefined,"0.15");u.lyricIn.characters=5;animG.add("statictext",undefined,"退场秒");u.lyricOut=animG.add("edittext",undefined,"0.12");u.lyricOut.characters=5;u.lyricFollowSinger=animG.add("checkbox",undefined,"歌词跟随演唱者色");u.lyricFollowSinger.value=true;u.lyricStroke=animG.add("checkbox",undefined,"歌词描边");u.lyricStroke.value=false;
        var lyricShadowG=lyricP.add("group");u.lyricShadowEnabled=lyricShadowG.add("checkbox",undefined,"主副歌词统一阴影");u.lyricShadowEnabled.value=true;lyricShadowG.add("statictext",undefined,"颜色");u.lyricShadowColor=lyricShadowG.add("edittext",undefined,"#000000");u.lyricShadowColor.characters=8;var lyricShadowPick=lyricShadowG.add("button",undefined,"选色");lyricShadowPick.onClick=function(){chooseColor(u.lyricShadowColor);};lyricShadowG.add("statictext",undefined,"透明度");u.lyricShadowOpacity=lyricShadowG.add("edittext",undefined,"48");u.lyricShadowOpacity.characters=4;lyricShadowG.add("statictext",undefined,"方向");u.lyricShadowDirection=lyricShadowG.add("edittext",undefined,"135");u.lyricShadowDirection.characters=4;lyricShadowG.add("statictext",undefined,"距离");u.lyricShadowDistance=lyricShadowG.add("edittext",undefined,"5");u.lyricShadowDistance.characters=4;lyricShadowG.add("statictext",undefined,"柔和度");u.lyricShadowSoftness=lyricShadowG.add("edittext",undefined,"16");u.lyricShadowSoftness.characters=4;

        var spectrumP=mediaTab.add("panel",undefined,"动态音频频谱");spectrumP.orientation="column";spectrumP.alignChildren=["left","center"];
        var spectrumModeG=spectrumP.add("group");u.spectrumEnabled=spectrumModeG.add("checkbox",undefined,"启用频谱");u.spectrumEnabled.value=true;spectrumModeG.add("statictext",undefined,"生成方式");u.spectrumMode=spectrumModeG.add("dropdownlist",undefined,["内置频谱","外部 AEP"]);u.spectrumMode.selection=0;spectrumModeG.add("statictext",undefined,"默认自动引用当前音乐");
        var spectrumPos=spectrumP.add("group");spectrumPos.add("statictext",undefined,"中心 X");u.spectrumX=spectrumPos.add("edittext",undefined,"960");u.spectrumX.characters=6;spectrumPos.add("statictext",undefined,"基线 Y");u.spectrumY=spectrumPos.add("edittext",undefined,"1050");u.spectrumY.characters=6;spectrumPos.add("statictext",undefined,"宽度");u.spectrumWidth=spectrumPos.add("edittext",undefined,"720");u.spectrumWidth.characters=6;spectrumPos.add("statictext",undefined,"外部缩放 %");u.spectrumScale=spectrumPos.add("edittext",undefined,"100");u.spectrumScale.characters=5;
        var spectrumFreq=spectrumP.add("group");spectrumFreq.add("statictext",undefined,"起始 Hz");u.spectrumStartFreq=spectrumFreq.add("edittext",undefined,"200");u.spectrumStartFreq.characters=5;spectrumFreq.add("statictext",undefined,"结束 Hz");u.spectrumEndFreq=spectrumFreq.add("edittext",undefined,"2000");u.spectrumEndFreq.characters=6;spectrumFreq.add("statictext",undefined,"频段");u.spectrumBands=spectrumFreq.add("edittext",undefined,"47");u.spectrumBands.characters=4;spectrumFreq.add("statictext",undefined,"最大高度");u.spectrumMaxHeight=spectrumFreq.add("edittext",undefined,"220");u.spectrumMaxHeight.characters=5;
        var spectrumStyle=spectrumP.add("group");spectrumStyle.add("statictext",undefined,"持续 ms");u.spectrumDurationMs=spectrumStyle.add("edittext",undefined,"90");u.spectrumDurationMs.characters=4;spectrumStyle.add("statictext",undefined,"厚度");u.spectrumThickness=spectrumStyle.add("edittext",undefined,"4");u.spectrumThickness.characters=4;spectrumStyle.add("statictext",undefined,"柔和度");u.spectrumSoftness=spectrumStyle.add("edittext",undefined,"50");u.spectrumSoftness.characters=4;spectrumStyle.add("statictext",undefined,"颜色");u.spectrumColor=spectrumStyle.add("edittext",undefined,"#000000");u.spectrumColor.characters=8;var spectrumColorPick=spectrumStyle.add("button",undefined,"选色");spectrumColorPick.onClick=function(){chooseColor(u.spectrumColor);};
        var spectrumFx=spectrumP.add("group");spectrumFx.add("statictext",undefined,"最小/最大半径");u.spectrumMinimax=spectrumFx.add("edittext",undefined,"2");u.spectrumMinimax.characters=4;spectrumFx.add("statictext",undefined,"对比度");u.spectrumContrast=spectrumFx.add("edittext",undefined,"50");u.spectrumContrast.characters=4;u.spectrumMirror=spectrumFx.add("checkbox",undefined,"中心镜像");u.spectrumMirror.value=true;u.spectrumSide=spectrumFx.add("dropdownlist",undefined,["仅向上","上下双向"]);u.spectrumSide.selection=0;u.spectrumAfterIntro=spectrumFx.add("checkbox",undefined,"首句开始后显示");u.spectrumAfterIntro.value=true;
        var spectrumFileG=spectrumP.add("group");spectrumFileG.add("statictext",undefined,"外部 AEP");u.spectrumPath=spectrumFileG.add("edittext",undefined,"");u.spectrumPath.characters=27;u.spectrumPath.enabled=false;var spectrumBrowse=spectrumFileG.add("button",undefined,"选择");spectrumBrowse.onClick=function(){var f=browseFile("选择频谱模板 AEP","After Effects Project:*.aep");if(f){state.spectrumFile=f;u.spectrumPath.text=f.fsName;}};spectrumFileG.add("statictext",undefined,"合成");u.spectrumCompName=spectrumFileG.add("edittext",undefined,"Spectrum_Template");u.spectrumCompName.characters=13;spectrumFileG.add("statictext",undefined,"音频层");u.spectrumAudioLayer=spectrumFileG.add("edittext",undefined,"AUDIO_PLACEHOLDER");u.spectrumAudioLayer.characters=14;

        var coverP=mediaTab.add("panel",undefined,"封面与首句前标题");coverP.orientation="column";coverP.alignChildren=["left","center"];
        var coverSwitch=coverP.add("group");u.coverEnabled=coverSwitch.add("checkbox",undefined,"生成独立封面合成");u.coverEnabled.value=true;u.introEnabled=coverSwitch.add("checkbox",undefined,"首句前显示同一标题区");u.introEnabled.value=true;coverSwitch.add("statictext",undefined,"封面时长");u.coverDuration=coverSwitch.add("edittext",undefined,"5");u.coverDuration.characters=5;
        var logoG=coverP.add("group");logoG.add("statictext",undefined,"标题模式");u.coverTitleMode=logoG.add("dropdownlist",undefined,["文字标题","Logo","Logo + 文字"]);u.coverTitleMode.selection=0;logoG.add("statictext",undefined,"Logo");u.coverLogoPath=logoG.add("edittext",undefined,"");u.coverLogoPath.characters=25;u.coverLogoPath.enabled=false;var logoBrowse=logoG.add("button",undefined,"选择");logoBrowse.onClick=function(){var f=browseFile("选择歌曲 Logo","Image:*.png;*.psd;*.jpg;*.jpeg;*.tif;*.tiff");if(f){state.coverLogoFile=f;u.coverLogoPath.text=f.fsName;}};logoG.add("statictext",undefined,"最大宽");u.coverLogoWidth=logoG.add("edittext",undefined,"1100");u.coverLogoWidth.characters=6;
        var titleG=coverP.add("group");titleG.add("statictext",undefined,"文字标题");u.songTitle=titleG.add("edittext",undefined,"Song Title");u.songTitle.characters=16;u.songTitleFont=titleG.add("edittext",undefined,"Arial-BoldMT");u.songTitleFont.characters=13;var songFontPick=titleG.add("button",undefined,"字体");songFontPick.onClick=function(){chooseFont(u.songTitleFont);};titleG.add("statictext",undefined,"字号");u.songTitleSize=titleG.add("edittext",undefined,"130");u.songTitleSize.characters=5;u.songTitleColor=titleG.add("edittext",undefined,"#E8A7C4");u.songTitleColor.characters=8;var songColorPick=titleG.add("button",undefined,"选色");songColorPick.onClick=function(){chooseColor(u.songTitleColor);};
        var titleFxG=coverP.add("group");titleFxG.add("statictext",undefined,"标题 Y");u.coverTitleY=titleFxG.add("edittext",undefined,"75%");u.coverTitleY.characters=6;u.coverTitleY.helpTip="可输入百分比或像素；75% 表示距画面底部四分之一高度";titleFxG.add("statictext",undefined,"发光强度");u.songTitleGlow=titleFxG.add("edittext",undefined,"0");u.songTitleGlow.characters=5;titleFxG.add("statictext",undefined,"范围");u.songTitleGlowRadius=titleFxG.add("edittext",undefined,"35");u.songTitleGlowRadius.characters=5;
        var infoG=coverP.add("group");infoG.add("statictext",undefined,"补充信息");u.coverInfo=infoG.add("edittext",undefined,"",{multiline:true});u.coverInfo.preferredSize=[260,55];u.coverInfoFont=infoG.add("edittext",undefined,"MicrosoftYaHei");u.coverInfoFont.characters=13;var infoFontPick=infoG.add("button",undefined,"字体");infoFontPick.onClick=function(){chooseFont(u.coverInfoFont);};infoG.add("statictext",undefined,"字号");u.coverInfoSize=infoG.add("edittext",undefined,"34");u.coverInfoSize.characters=4;
        var infoStyleG=coverP.add("group");infoStyleG.add("statictext",undefined,"说明颜色");u.coverInfoColor=infoStyleG.add("edittext",undefined,"#666666");u.coverInfoColor.characters=8;var infoColorPick=infoStyleG.add("button",undefined,"选色");infoColorPick.onClick=function(){chooseColor(u.coverInfoColor);};infoStyleG.add("statictext",undefined,"说明 Y");u.coverInfoY=infoStyleG.add("edittext",undefined,"930");u.coverInfoY.characters=6;

        var actionG=win.add("group");actionG.alignment=["fill","bottom"];var restoreCompBtn=actionG.add("button",undefined,"从选中合成恢复");restoreCompBtn.onClick=restoreFromSelectedComp;var saveDefaultsBtn=actionG.add("button",undefined,"保存当前为默认");saveDefaultsBtn.onClick=saveDefaultConfig;var restoreDefaultsBtn=actionG.add("button",undefined,"恢复出厂默认");restoreDefaultsBtn.onClick=restoreFactoryConfig;var generateBtn=actionG.add("button",undefined,"生成 AE 合成");generateBtn.alignment=["fill","center"];generateBtn.preferredSize.height=38;generateBtn.onClick=generate;
        state.factoryConfig=snapshotUIConfig();loadDefaultConfig();tabs.selection=0;refreshCharacterList(-1);refreshPresetDrop();syncProjectRolesUI();
        win.onResizing=win.onResize=function(){this.layout.resize();};
        if(win instanceof Window){win.center();win.show();}else{win.layout.layout(true);}
        return win;
    }

    buildUI(thisObj);
})(this);
