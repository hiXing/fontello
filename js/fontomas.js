var myapp = (function () {

    var cfg = {
        id: {
            tab: "#tab",
            notification: "#notifications-container",

            bad_browser: "#fm-bad-browser",
            glyph_count: "#fm-glyph-count",

            file: "#fm-file",
            file_browse_button: "#fm-file-browse-button",
            file_drop_zone: "#fm-file-drop-zone",

            icon_size: "#fm-icon-size",
            use_embedded: "#fm-use-embedded",

            tab1_content: "#fm-tab1-content",
            tab2_content: "#fm-tab2-content",

            form_charset: "#fm-form-charset",

            font: "#fm-font",
            icon_assignments: "#fm-icon-assignments"
        },
        class: {
            glyph_group: ".fm-glyph-group",
            disable_on_demand: ".fm-disable-on-demand"
        },
        template: {
            upload_status: { id: "#fm-tpl-upload-status" },
            icon_size_button: { id: "#fm-tpl-icon-size-button" },
            embedded: { id: "#fm-tpl-embedded" },
            glyph: { id: "#fm-tpl-glyph" },
            glyph_group: { id: "#fm-tpl-glyph-group" },
            font: { id: "#fm-tpl-font" },
            rearrange_glyph: { id: "#fm-tpl-rearrange-glyph" }
        },

        // class icon_size_prefix+"-<num>" added when icon size has changed
        icon_size_prefix: "fm-icon-size-",
        icon_size_classes: "", // precalculated by init()

        preview_icon_sizes: [32, 24, 16],
        live_update: true,
        basic_latin: {
            str: "",    // precalculated by init()
            begin: 33,
            end: 126,
            extra: " ",
        },
        unicode_private: {
            begin: 0xf0000,
            end: 0xf005e
        },
        draggable_options: {
            revert: "invalid",
            cursor: "move",
            helper: "clone",
            opacity: 0.5,
            disabled: false
        },
        path_options: {
            fill: "#000",
            stroke: "#000",
            transform: "S1 -1"      // svg font's y axis goes upward
        }
    };
    var myfiles = [];
    var myglyphs = [];
    var glyph_count = 0;
    var xml_template = null;
    var g_id = 0;   // next glyph id

    var init = function () {
        // check browser's capabilities
        if (!isOkBrowser()) {
            console.log("bad browser");
            $(cfg.id.bad_browser).modal({keyboard: false});
            return;
        };

        // init icon_size_classes
        cfg.icon_size_classes = cfg.preview_icon_sizes.map(function (item) {
            return cfg.icon_size_prefix+item;
        }).join(" ");

        // init cfg.basic_latin.str
        cfg.basic_latin.str = "";
        for (var i=cfg.basic_latin.begin; i<=cfg.basic_latin.end; i++)
            cfg.basic_latin.str += String.fromCharCode(i);
        cfg.basic_latin.str += cfg.basic_latin.extra;

        // init templates
        for (var key in cfg.template) {
            cfg.template[key].tpl = $(cfg.template[key].id).clone().removeAttr("id");
            $(cfg.template[key].id).remove();
        }

        // init file upload form
        $(cfg.id.file).change(function (event) {
            addUploadedFonts(event.target.files);
        });
        $(cfg.id.file_browse_button).click(function (event) {
  	        event.preventDefault();
            $(cfg.id.file).click();
        });

        // init file drag and drop
        $(cfg.id.file_drop_zone).on("dragover", function (event) {
	        event.stopPropagation();
	        event.preventDefault();
	        event.originalEvent.dataTransfer.dropEffect = 'copy';
        });
        $(cfg.id.file_drop_zone).on("drop", function (event) {
	        event.stopPropagation();
	        event.preventDefault();
            addUploadedFonts(event.originalEvent.dataTransfer.files);
        });

        // init preview icon size selection
        for (var i=0, len=cfg.preview_icon_sizes.length; i<len; i++) {
            var tpl = $(cfg.template.icon_size_button.tpl).clone();
            tpl.toggleClass("active", i == 0);
            tpl.val(cfg.preview_icon_sizes[i]);
            tpl.text(cfg.preview_icon_sizes[i] + "px");
            tpl.click(function (event) {
                event.preventDefault();
                var size = $(this).val();
                var sizepx = size + "px";
                console.log('size='+size);
                $(cfg.class.glyph_group).removeClass(cfg.icon_size_classes)
                    .addClass(cfg.icon_size_prefix+size);
                $(cfg.id.tab1_content)
                    .find(".gd").css({
                        width: sizepx,
                        height: sizepx,
                        "font-size": sizepx
                    })
                    .find("svg").css({
                        width: sizepx, 
                        height: sizepx
                    });

                $(cfg.id.tab2_content)
                    .find(".rg-icon").css({
                        width: sizepx,
                        height: sizepx,
                        "font-size": sizepx
                    })
                    .find("svg").css({
                        width: sizepx, 
                        height: sizepx
                    });
            });
            $(cfg.id.icon_size).append(tpl);
        }

        // init "use embedded" dropdown
        initUseEmbedded();

        // auto load embedded fonts
        addEmbeddedFonts(fm_embedded_fonts);

        $("#tab").tab("show");
        // activate first tab
        $("#tab a:first").tab("show");

        // init charset selection
        $(cfg.id.form_charset).find("input.fm-charset").change(function () {
            var charset = $(this).val();
            var content = $(cfg.id.tab2_content);
            if (charset == "basic_latin") {
                content.find("div.rg-top").each(function (index) {
                    // FIXME
                    if (cfg.basic_latin.str[index] == " ")
                        $(this).text("space");
                    else
                        $(this).text(cfg.basic_latin.str[index]);
                });
                content.find("div.rg-bottom").each(function (index) {
                    $(this).text(toUnicode(cfg.basic_latin.str[index]));
                });
                content.find("input.fm-unicode").each(function (index) {
                    $(this).val(cfg.basic_latin.str[index]);
                });
            } else {
                // FIXME
                content.find("div.rg-top").each(function (index) {
                    var c = (cfg.unicode_private.begin+index)
                        .toString(16).toUpperCase();
                    $(this).text("&#x"+c+";");
                });
                content.find("div.rg-bottom").each(function (index) {
                    var c = (cfg.unicode_private.begin+index)
                        .toString(16).toUpperCase();
                    $(this).text("U+"+c);
                });
                content.find("input.fm-unicode").each(function (index) {
                    var c = (cfg.unicode_private.begin+index)
                        .toString(16).toUpperCase();
                    $(this).val("&#x"+c+";");
                });
            }

            if (cfg.live_update) {
                updateFont();
                updateIconAssignments();
            }
        });
       
        // init drag and drop for rearrange icons
        for (var i=0, len=cfg.basic_latin.str.length; i<len; i++) {
            var tpl = $(cfg.template.rearrange_glyph.tpl).clone();

            var char = cfg.basic_latin.str[i];
            tpl.attr("id", "rgl"+i);
            tpl.find(".fm-unicode").attr("id", "rgu"+i).val(toCharRef(char));
            tpl.find(".rg-top").text(char != " " ? char : "space");
            tpl.find(".rg-bottom").text(toUnicode(char));
            tpl.find(".rg-icon").attr("id", "rgd"+i);
            tpl.find(".rg-icon").droppable({
                drop: function (event, ui) {
                    console.log("drop");
                    var draggable=ui.draggable;
                    var g_id=$(this).siblings("input:checkbox").attr("value");
                    var d=$(this).contents();

                    $(this).siblings("input:checkbox").attr({value: draggable.siblings("input:checkbox").attr("value")});
                    $(this).empty().append(draggable.contents());

                    draggable.siblings("input:checkbox").attr({value: g_id});
                    draggable.empty().append(d);

                    if (!$(this).parent().hasClass("selected")) {
                        $(this).parent().addClass("selected");
                        draggable.parent().removeClass("selected");
                        $(this).draggable(cfg.draggable_options);
                        draggable.draggable("disable");
                        $(this).siblings("input:checkbox").attr({checked: true});
                       draggable.siblings("input:checkbox").attr({checked: false});
                    }

                    if (cfg.live_update) {
                        updateFont();
                        updateIconAssignments();
                    }
                }
            });
            $(cfg.id.tab2_content).append(tpl);
        }

        // init "select all"
        $("a.select-all").click(function (event) {
            $($(this).attr("href")).select();
            event.preventDefault();
        });
    };

    var isOkBrowser = function () {
        // FF3.6+ Chrome6+ Opera11.1+
        var filereader = !!window.FileReader;

        // FF4+ Chrome11+
        var indexeddb = Modernizr.indexeddb;

        // IE8+ FF3.5 Chrome4+ Safari4+ Opera10.5+
        var localstorage = Modernizr.localstorage;

        //FF3.6+ Chrome6+ Opera11.1+
        return filereader && (indexeddb || localstorage);
    };

    var initUseEmbedded = function () {
        for (var i=0, len=fm_embedded_fonts.length; i<len; i++) {
            var tpl = $(cfg.template.embedded.tpl).clone();
            var is_added = fm_embedded_fonts[i].is_added;
            var item = tpl.find(".fm-font-name");
            item.toggleClass("disabled", is_added)
                .data("embedded_id", i).
                text(fm_embedded_fonts[i].fontname);
            if (is_added) {
                item.off("click");
            } else {
                item.click(function (event) {
                    console.log("click Use Embedded");
                    var e_id = $(this).data("embedded_id");
                    console.assert(fm_embedded_fonts[e_id]);
                    if (fm_embedded_fonts[e_id])
                        addEmbeddedFonts([fm_embedded_fonts[e_id]]);
                });
            }
            $(cfg.id.use_embedded).append(tpl);
        }
    };

    var updateUseEmbedded = function () {
        console.log("updateUseEmbedded");
        $(cfg.id.use_embedded).empty();
        initUseEmbedded();
    };

    var addEmbeddedFonts = function (embedded_fonts) {
        addFontsAsStrings(embedded_fonts, function (fileinfo) {
            // onload closure
            var e_id = fileinfo.embedded_id;
            addGlyphGroup(fileinfo, function (fileinfo) {
                // onclose closure
                fm_embedded_fonts[e_id].is_added = fileinfo.is_added;
                updateUseEmbedded();
                updateGlyphCount();
            });
            fm_embedded_fonts[e_id].is_added = fileinfo.is_added;
            updateUseEmbedded();
        });
    };

    var addUploadedFonts = function (files) {
        addFonts(files, function (fileinfo) {
            // onload closure
            addGlyphGroup(fileinfo, function () {
                // onclose closure
                updateGlyphCount();
            });
        });
    };

    var addFontsAsStrings = function (files, cb_onload) {
        console.log("addFontsAsStrings files.length=", files.length);
        for (var i=0, f; f=files[i]; i++) {
            var idx = myfiles.push({
                id:             null,
                filename:       f.filename,
                filesize:       f.content.length,
                filetype:       f.filetype,
                fontname:       "unknown",
                is_loaded:      true,
                is_ok:          false,
                is_added:       false,
                is_dup:         false,
                error_msg:      "",
                content:        f.content,
                embedded_id:    f.id
            }) - 1;
            myfiles[idx].id = idx;

            if (cb_onload)
                cb_onload(myfiles[idx]);

            f.is_ok = myfiles[idx].is_ok;
            f.is_added = myfiles[idx].is_added;
            f.fontname = myfiles[idx].fontname;
        }
    };

    var addFonts = function (files, cb_onload) {
        console.log("addFonts");
        for (var i=0, f; f=files[i]; i++) {
            var idx = myfiles.push({
                id:             null,
                filename:       f.name,
                filesize:       f.size, 
                filetype:       f.type,
                fontname:       "unknown",
                is_loaded:      false,
                is_ok:          false,
                is_added:       false,
                is_dup:         false,
                error_msg:      "",
                content:        null,
                embedded_id:    null
            }) - 1;
            myfiles[idx].id = idx;

            var reader = new FileReader();
            reader.onload = (function (fileinfo) {
                return function (e) {
                    // FIXME: race condition?
                    // is there a file with the same content?
                    var is_exist = false;
                    for (var i=0, len=myfiles.length; i<len; i++) {
                        if (!myfiles[i] || !myfiles.is_ok)
                            continue;
                        if (myfiles[i].content == e.target.result) {
                            fileinfo.is_dup = is_exist = true;
                            break;
                        }
                    }
                    if (!is_exist) {
                        fileinfo.content = e.target.result;
                        fileinfo.is_loaded = true;
                    }

                    if (cb_onload)
                        cb_onload(fileinfo);
                };
            })(myfiles[idx]);
            reader.readAsBinaryString(f);
        }
    };

/*
    var updateFilesList = function () {
        var output = [];
	    for (var i=0, f; f = myfiles[i]; i++) {
            var tr = cfg.template.upload_status.tpl.clone();
            var row = [
                f.name,
                f.size,
                f.is_invalid ? "invalid" :
                    f.is_dup ? "duplicate, skipped" : 
                    f.is_loaded ? "loaded" : "loading..."
            ];
            tr.find("td").each(function (index) {
                $this = $(this);
                $this.text(row[index]);
            });
            output.push(tr.html());
	    }
        $(cfg.template.upload_status.id).empty().append(output.join(""));
    };
*/

    var notify = function (title, text, extra_options) {
        options = {
            title: title,
            text: text,
            icon: "img/alert.png"
        };
        $.extend(options, extra_options);
        $(cfg.id.notification).notify("create", options);
    };

    var addGlyphGroup = function (fileinfo, cb_onclose) {
        console.log("addGlyphGroup id=", fileinfo.id);
        var div = cfg.id.select_glyphs;

        // if it is a dup, skip it
        if (fileinfo.is_dup)
            return;

        var xml = null;
        try {
            xml = $.parseXML(fileinfo.content);
        } catch (e) {
            console.log("invalid xml");
            fileinfo.is_ok = false;
            fileinfo.error_msg = "invalid xml";

            notify("XML parsing failed",
                "Couldn't parse file '"+fileinfo.filename+"'"
            );
            return;
        }
        fileinfo.is_ok = true;

        //FIXME
        if (!xml_template)
            xml_template = makeXmlTemplate($.parseXML(fileinfo.content));

        // FIXME
        $(cfg.id.tab1_content).find(".fm-glyph-id").off("click");

        var horiz_adv_x = $("font:first", xml).attr("horiz-adv-x") || 1000;
        var ascent = $("font-face:first", xml).attr("ascent") || 750;
        var descent = $("font-face:first", xml).attr("descent") || -250;
        fileinfo.fontname = $("font:first", xml).attr("id") || "unknown";

        var size = $(cfg.id.icon_size).find("button.active").val();
        var sizepx = size + "px";

        // add a font
        var tpl_font = $(cfg.template.font.tpl).clone()
            .attr("id", "fm-font-"+fileinfo.id);
        tpl_font.find(".fm-font-name").text(fileinfo.fontname);
        tpl_font.find(".fm-font-anchor").attr("href", "#font-"+fileinfo.id);
        tpl_font.find(".fm-font-close").click(function (event) {
            removeGlyphGroup(fileinfo);
            if (cb_onclose)
                cb_onclose(fileinfo);
        });
        $(cfg.id.tab1_content).append(tpl_font);

        // add a glyph-group
        var tpl_gg = $(cfg.template.glyph_group.tpl).clone();
        tpl_gg.addClass(cfg.icon_size_prefix+size);
        tpl_font.append(tpl_gg);

        // add glyphs to the glyph group
        $("glyph", xml).filter(function (i) {
            //return i < 10;  // for testing
            return true;
        }).each(function () {
            var tpl = $(cfg.template.glyph.tpl).clone();
            tpl.find(".fm-glyph-id").val(g_id);
            tpl.find(".gd")
                .attr("id", "gd"+g_id)
                .css({
                    width: sizepx,
                    height: sizepx,
                    "font-size": sizepx
                });
            $(tpl_gg).append(tpl);

            // add svg 
            var r = Raphael("gd"+g_id, size, size);
            r.setViewBox(0, descent, horiz_adv_x, ascent-descent, true);
            var g = r.path($(this).attr("d")).attr(cfg.path_options);
            g.show();

            myglyphs[g_id] = { dom_node: this, file_id: fileinfo.id };
            g_id++;
        });

        $(cfg.id.tab1_content).find(".fm-glyph-id").click(function (event) {
            $(this).parent().toggleClass("selected", $(this).is(":checked"));
            toggleGlyph($(this).attr("value"), $(this).is(":checked"));

            if (cfg.live_update) {
                updateFont();
                updateIconAssignments();
            }
        });

        fileinfo.is_added = true;

        // scroll to the loaded font
/*
        var fonthash = 'a[href="#font-'+fileinfo.id+'"]';
        $("html,body").animate({scrollTop: $(fonthash).offset().top}, 500);
*/
    };

    var removeGlyphGroup = function (fileinfo) {
        console.log("removeGlyphGroup id=", fileinfo.id);

        var file_id = fileinfo.id;

        // free mem
        for (var i=0, len=myglyphs.length; i<len; i++) {
            if (myglyphs[i].file_id == file_id) {
                myglyphs[i].dom_node = null;
                myglyphs[i].file_id = -1;   // null?
            }
        }
        myfiles[file_id] = null;

        // remove associated html mark up
        var font = $('#fm-font-'+file_id);
        font.find("input:checkbox:checked").each(function() {
            var glyph_id = $(this).val();
            removeGlyph(glyph_id);
        });
        font.remove();

        fileinfo.is_added = false;
    };

    var updateGlyphCount = function () {
        $(cfg.id.glyph_count).text(glyph_count);
    };

    var toggleGlyph = function (g_id, is_checked) {
        if (is_checked)
            addGlyph(g_id);
        else
            removeGlyph(g_id);
        updateGlyphCount();
    };

    // add a glyph to the rearrange zone
    var addGlyph = function (g_id) {
        console.log("addGlyph g_id=", g_id);
        var checkbox=$(cfg.id.tab2_content).find(".fm-glyph-id:not(:checked):first");
        checkbox.attr({value: g_id, checked: true});
        checkbox.parent().addClass("selected");
        var svg = $("#gd"+g_id).contents().clone(false);
        var icon = checkbox.siblings(".rg-icon");
        icon.append(svg)
            .draggable(cfg.draggable_options)
            .attr("style", $("#gd"+g_id).attr("style"));

        if (glyph_count == 0)
            toggleMenu(true);
        glyph_count++;
    };

    // remove a glyph from the rearrange zone
    var removeGlyph = function (g_id) {
        console.log("removeGlyph g_id=", g_id);
        var checkbox=$(cfg.id.tab2_content).find(".fm-glyph-id:checked[value='"+g_id+"']");
        checkbox.attr({value: "", checked: false});
        checkbox.parent().removeClass("selected");
        checkbox.siblings(".rg-icon").empty();

        if (glyph_count == 1)
            toggleMenu(false);
        glyph_count--;
        console.assert(glyph_count >= 0);
    };

    var toggleMenu = function (enabled) {
        console.log("toggleMenu");
        $(cfg.id.tab).find("a"+cfg.class.disable_on_demand)
            .toggleClass("disabled", !enabled);
    };

    var makeXmlTemplate = function (xml) {
        $("glyph", xml).remove();
        return xml;
    };

    // update font's textarea
    var updateFont = function () {
        if (!xml_template)
            return;

        var glyphs = [];
        $(cfg.id.tab2_content)
            .find("input:checkbox:checked")
            .each(function () {
                var $this = $(this);
                var g_id = $this.val();
                var unicode = $this.siblings("input.fm-unicode").val();
                if (!myglyphs[g_id]) {
                    console.log("undefined myglyphs[", g_id, "]");
                    return; 
                }
                var g = $(myglyphs[g_id].dom_node);
                g.attr("unicode", unicode);
                glyphs.push(outerHtml(g));
            });
        $("glyph", xml_template).remove();
        $("font", xml_template).append($(glyphs.join("\n")));
        $(cfg.id.font).text(xmlToString(xml_template));
    };

    // update IA's textarea
    var updateIconAssignments = function () {
        var lines = [];
        lines.push(
            "/*",
            "", 
            "Icon                		Hex entity          CSS content",
            "======================================================================"
        );

        $(cfg.id.tab2_content)
            .find("input:checkbox:checked")
            .each(function () {
                var $this = $(this);
                var g_id = $this.val();
                var unicode = $this.siblings("input.fm-unicode").val();
                var tmp = toEntityAndCss(unicode);
                lines.push(
                    rpad("n/a", 32)
                    +rpad(tmp.entity, 20)
                    +tmp.css
                );
            });
        lines.push("", "*/");
        $(cfg.id.icon_assignments).text(lines.join("\n"));
    }

    // ===============
    // misc functions
    // ===============
    var outerHtml = function (jquery_object) {
        return $("<div/>").append(jquery_object.clone()).html();
    };

    var xmlToString = function(xmlDom) {
        // cross-browser
        var result = (typeof XMLSerializer!=="undefined")
            ? (new window.XMLSerializer()).serializeToString(xmlDom)
            : xmlDom.xml;
        //FIXME: quickfix: get rid of unwanted xmlns insertion
        result = result.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
        //FIXME: quickfix: remove the extra newlines
        result = result.replace(/>(\s)*<glyph/gm, ">\n<glyph");
        //FIXME: quickfix: &amp; => &
        result = result.replace(/&amp;#x/gm, "&#x");
        return result;
    };

    // return char in CharRef notation
    var toCharRef = function (char) {
        return "&#x" + char.charCodeAt(0).toString(16) + ";";
    };

    // return char in U+ notation
    var toUnicode = function (char) {
        var c = char.charCodeAt(0).toString(16).toUpperCase();
        if (c.length < 4)
            c = "0000".substr(0, 4-c.length) + c;
        return "U+" + c;
    };

    //FIXME
    var toEntityAndCss = function (char) {
        var code = char.charCodeAt(0);
        if (32 <= code && code <= 127)
            return {
                entity: char,
                css: "content: '"+char+"';"
            };
        else
            return {
                entity: toCharRef(char),
                css: "content: '\\"+code.toString(16)+"';"
            };  
    };

    // string functions
    var repeat = function (s, times) {
        if (times < 1)
            return "";
        var result = "";
        while (times > 0) {
            if (times & 1)
                result += s;
            times >>= 1;
            s += s;
        }
        return result; 
    };

    var rpad = function (s, len) {
        if (s.length < len)
            return s + repeat(" ", len - s.length);
        else
            return s;
    };

    var lpad = function (s, len) {
        if (s.length < len)
            return repeat(" ", len - s.length) + s;
        else
            return s;
    };

    // public interface
	return {
		init: init
	};
})();

$(document).ready(function () {
    myapp.init();
});