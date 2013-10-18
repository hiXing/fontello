// Font settings dialog
//
'use strict';


var _  = require('lodash');


N.wire.once('navigate.done', function () {

  var $dialog, glyph;

  N.wire.on('cmd:glyph_options', function gopt_dialog(event) {
    var $el    = $(event.currentTarget);
    var id    = $el.data('id');
    glyph = N.app.fontsList.glyphMap[id];

    // Render dialog window.
    var locals = {
      css_name: glyph.name(),
      hex_code: glyph.customHex(),
      keywords: glyph.search.join(',')
    };
    $dialog = $(N.runtime.render(module.apiPath, locals)).appendTo('body');
/*
    ko.applyBindings(settings, $dialog.get(0));

    $dialog.find('#st__upm').numeric({ decimal: false, negative: false});
    $dialog.find('#st__ascent').numeric({ decimal: false, negative: false});
    $dialog.find('#st__descent').numeric({ decimal: false });
    $dialog.find('#st__baseline').numeric();

    $dialog.find('._popover').popover();
*/
    $dialog.on('shown.bs.modal', function () {
    });

    $dialog.on('hidden.bs.modal', function () {
      //ko.cleanNode($(this));
      $(this).remove();
    });

    // Show dialog.
    $dialog.modal();
  });

  N.wire.on('cmd:glyph_options.save', function settings_dialog_save() {
    glyph.originalName = $dialog.find('#gopt__css_name').val();
    glyph.name(glyph.originalName);
    glyph.customHex($dialog.find('#gopt__code').val());

    var keywords = $dialog.find('#gopt__keywords').val().split(',');
    glyph.search = _.map(keywords, function(kw) { return $.trim(kw); });

    N.wire.emit('search_flush');
    N.wire.emit('session_save');

    $dialog.modal('hide');
  });

});
