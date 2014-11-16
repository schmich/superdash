// See http://misc.flogisoft.com/bash/tip_colors_and_formatting
var colorize = function(str) {
  var ansi = {
    '0':  'ansi-reset',
    '1':  'ansi-bold',
    '2':  'ansi-dim',
    '4':  'ansi-underline',
    '5':  'ansi-blink',
    '7':  'ansi-invert',
    '8':  'ansi-hidden',

    // Foreground (normal)
    '30': 'ansi-fg-black',
    '31': 'ansi-fg-red',
    '32': 'ansi-fg-green',
    '33': 'ansi-fg-yellow',
    '34': 'ansi-fg-blue',
    '35': 'ansi-fg-magenta',
    '36': 'ansi-fg-cyan',
    '37': 'ansi-fg-lgray',
    '39': 'ansi-fg-default',

    // Background (normal)
    '40': 'ansi-bg-black',
    '41': 'ansi-bg-red',
    '42': 'ansi-bg-green',
    '43': 'ansi-bg-yellow',
    '44': 'ansi-bg-blue',
    '45': 'ansi-bg-magenta',
    '46': 'ansi-bg-cyan',
    '47': 'ansi-bg-lgray',

    // Foreground (light)
    '90': 'ansi-fg-gray',
    '91': 'ansi-fg-lred',
    '92': 'ansi-fg-lgreen',
    '93': 'ansi-fg-lyellow',
    '94': 'ansi-fg-lblue',
    '95': 'ansi-fg-lmagenta',
    '96': 'ansi-fg-lcyan',
    '97': 'ansi-fg-white',

    // Background (light)
    '100': 'ansi-bg-gray',
    '101': 'ansi-bg-lred',
    '102': 'ansi-bg-lgreen',
    '103': 'ansi-bg-lyellow',
    '104': 'ansi-bg-lblue',
    '105': 'ansi-bg-lmagenta',
    '106': 'ansi-bg-lcyan',
    '107': 'ansi-bg-white'
  };

  str = str.replace(/\033\[((3|4|9|10)(\d))m(.*?)(?=(\033\[(0|((3|4|9|10)(\d)))m)|$)/g, function(match, p1, p2, p3, p4) {
    return '<span class="' + ansi[p1] + '">' + p4 + '</span>';
  });

  str = str.replace(/\033\[1m(.*?)(?=((\033\[(0|21)m)|$))/g, function(match, p1) {
    return '<span class="ansi-bold">' + p1 + '</span>';
  });

  str = str.replace(/\033\[2m(.*?)(?=((\033\[(0|22)m)|$))/g, function(match, p1) {
    return '<span class="ansi-dim">' + p1 + '</span>';
  });

  str = str.replace(/\033\[4m(.*?)(?=((\033\[(0|24)m)|$))/g, function(match, p1) {
    return '<span class="ansi-underline">' + p1 + '</span>';
  });

  str = str.replace(/\033\[5m(.*?)(?=((\033\[(0|25)m)|$))/g, function(match, p1) {
    return '<span class="ansi-blink">' + p1 + '</span>';
  });

  str = str.replace(/\033\[7m(.*?)(?=((\033\[(0|27)m)|$))/g, function(match, p1) {
    return '<span class="ansi-invert">' + p1 + '</span>';
  });

  str = str.replace(/\033\[8m(.*?)(?=((\033\[(0|28)m)|$))/g, function(match, p1) {
    return '<span class="ansi-hidden">' + p1 + '</span>';
  });

  str = str.replace(/\033\[(0|21|22|24|25|27|28)m/g, '');

  return str;
};
