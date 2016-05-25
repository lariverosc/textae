TextAE
======

*An embeddable, web-based visual editor of text annotation*


homepage
--------

http://textae.pubannotation.org/

Usage
-----

## parameters

This editor is customizable by html attributes.

### source

Set the url of an annotations json.

Example:
```html
<div class="textae-editor" source="./annotations.json" ></div>
```

### config

Set the url of a config json.

Example:
```html
<div class="textae-editor" config="./config.json" ></div>
```

### autocompletion_ws

Set the url of the autocompletion web service.

Example:
```html
<div class="textae-editor" autocompletion_ws="/autocomplete?order=desc"></div>
```

### mode

Set default edit mode.
values:

- view (default)
- edit

Example:

```html
<div class="textae-editor" mode="edit"></div>
```

### control

Show the control bar of the editor.

- auto (default) : Show the control bar the editable editor is selected
- visible : Show the control bar always
- hidden : Do not show the control bar always

Example:
```html
<div class="textae-editor" status_bar="visible" ></div>
```

### status_bar

Show the status bar of the editor.
When the value is 'on', show the status bar.
the status bar is not shown at default.

Example:
```html
<div class="textae-editor" status_bar="on" ></div>
```

Contributors (so far)
---------------------

- Jin-Dong Kim
- Yue Wang
- Shigeru Nakajima


License
-------

Released under [MIT license](http://opensource.org/licenses/MIT).
