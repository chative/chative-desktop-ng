// eslint-disable-next-line strict
function watermark() {
  var defaultSettings = {
    watermark_txt: 'text',
    watermark_x: 10,
    watermark_y: 20,
    watermark_rows: 100,
    watermark_cols: 100,
    watermark_x_space: 0,
    watermark_y_space: 0,
    watermark_color: '#ff0000',
    watermark_alpha: 0.205,
    watermark_fontsize: '16px',
    watermark_width: 108,
    watermark_height: 24,
  };

  if (arguments.length === 1 && typeof arguments[0] === 'object') {
    var src = arguments[0] || {};
    for (const key in src) {
      if (src[key] && defaultSettings[key] && src[key] === defaultSettings[key])
        continue;
      else if (src[key]) defaultSettings[key] = src[key];
    }
  }

  var oTemp = document.createDocumentFragment();

  var page_width = Math.max(
    document.body.scrollWidth,
    document.body.clientWidth
  );
  var page_height = Math.max(
    document.body.scrollHeight,
    document.body.clientHeight
  );

  if (
    defaultSettings.watermark_cols === 0 ||
    parseInt(
      defaultSettings.watermark_x +
        defaultSettings.watermark_width * defaultSettings.watermark_cols +
        defaultSettings.watermark_x_space * (defaultSettings.watermark_cols - 1)
    ) > page_width
  ) {
    defaultSettings.watermark_cols = parseInt(
      (page_width -
        defaultSettings.watermark_x +
        defaultSettings.watermark_x_space) /
        (defaultSettings.watermark_width + defaultSettings.watermark_x_space)
    );
    defaultSettings.watermark_x_space = parseInt(
      (page_width -
        defaultSettings.watermark_x -
        defaultSettings.watermark_width * defaultSettings.watermark_cols) /
        (defaultSettings.watermark_cols - 1)
    );
  }
  if (
    defaultSettings.watermark_rows === 0 ||
    parseInt(
      defaultSettings.watermark_y +
        defaultSettings.watermark_height * defaultSettings.watermark_rows +
        defaultSettings.watermark_y_space * (defaultSettings.watermark_rows - 1)
    ) > page_height
  ) {
    defaultSettings.watermark_rows = parseInt(
      (defaultSettings.watermark_y_space +
        page_height -
        defaultSettings.watermark_y) /
        (defaultSettings.watermark_height + defaultSettings.watermark_y_space)
    );
    defaultSettings.watermark_y_space = parseInt(
      (page_height -
        defaultSettings.watermark_y -
        defaultSettings.watermark_height * defaultSettings.watermark_rows) /
        (defaultSettings.watermark_rows - 1)
    );
  }
  var x;
  var y;
  for (var i = 0; i < defaultSettings.watermark_rows - 1; i++) {
    y =
      defaultSettings.watermark_y +
      (defaultSettings.watermark_y_space + defaultSettings.watermark_height) *
        i;
    for (var j = 0; j < defaultSettings.watermark_cols; j++) {
      x =
        defaultSettings.watermark_x +
        (defaultSettings.watermark_width + defaultSettings.watermark_x_space) *
          j;

      var mask_div = document.createElement('div');
      mask_div.className = 'simple_blind_watermark';
      mask_div.appendChild(
        document.createTextNode(defaultSettings.watermark_txt)
      );

      mask_div.style.left = x + 'px';
      mask_div.style.top = y + 'px';
      oTemp.appendChild(mask_div);
    }
  }
  document.body.appendChild(oTemp);
}
