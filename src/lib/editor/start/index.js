import Observable from 'observ'
import * as ajaxAccessor from '../../util/ajaxAccessor'
import StatusBar from '../../component/StatusBar'
import getParams from './getParams'
import SpanConfig from './SpanConfig'
import Command from './Command'
import TypeContainer from './TypeContainer'
import View from './View'
import Presenter from './Presenter'
import bindMouseEvent from './bindMouseEvent'
import DaoHandler from './DaoHandler'
import APIs from './APIs'
import calculateLineHeight from './calculateLineHeight'
import focusEditorWhenFocusedChildRemoved from './focusEditorWhenFocusedChildRemoved'

export default function(editor, dataAccessObject, history, buttonController, annotationData, selectionModel, clipBoard, writable) {
  const params = getParams(editor[0]),
    spanConfig = new SpanConfig(),
    // Users can edit model only via commands.
    command = new Command(editor, annotationData, selectionModel, history),
    typeGap = new Observable(-1),
    typeContainer = new TypeContainer(annotationData),
    view = new View(editor, annotationData, selectionModel, buttonController, typeGap, typeContainer, writable),
    presenter = new Presenter(
      editor,
      annotationData,
      selectionModel,
      view,
      command,
      spanConfig,
      clipBoard,
      buttonController,
      typeGap,
      typeContainer,
      writable,
      params.get('autocompletion_ws'),
      params.get('mode')
    )

  bindMouseEvent(editor, presenter, view)
  focusEditorWhenFocusedChildRemoved(editor)

  // Manage the original annotation
  let originalAnnotation

  const daoHandler = new DaoHandler(
      dataAccessObject,
      history,
      annotationData,
      typeContainer,
      () => originalAnnotation,
      params.get('annotation')
    ),
    statusBar = getStatusBar(editor, params.get('status_bar'))

  if (params.get('control') === 'visible') {
    editor[0].classList.add('textae-editor--control-visible')
  }
  if (params.get('control') === 'hidden') {
    editor[0].classList.add('textae-editor--control-hidden')
  }

  dataAccessObject
    .on('load', data => {
      setAnnotation(spanConfig, typeContainer, annotationData, data.annotation, params.get('config'))
      statusBar.status(data.source)
      originalAnnotation = data.annotation
    })

  originalAnnotation = loadAnnotation(spanConfig, typeContainer, annotationData, statusBar, params, dataAccessObject)

  const updateLineHeight = () => calculateLineHeight(editor, annotationData, typeContainer, typeGap, view)

  editor.api = new APIs(
    command,
    presenter,
    daoHandler,
    buttonController,
    view,
    updateLineHeight
  )

  // Add tabIndex to listen to keyboard events.
  editor[0].tabIndex = -1
}

function loadAnnotation(spanConfig, typeContainer, annotationData, statusBar, params, dataAccessObject) {
  const annotation = params.get('annotation')

  if (annotation) {
    if (annotation.has('inlineAnnotation')) {
      // Set an inline annotation.
      let originalAnnotation = JSON.parse(annotation.get('inlineAnnotation'))

      setAnnotation(spanConfig, typeContainer, annotationData, originalAnnotation, params.get('config'))
      statusBar.status('inline')
      return originalAnnotation
    } else if (annotation.has('url')) {
      // Load an annotation from server.
      dataAccessObject.getAnnotationFromServer(annotation.get('url'))
    } else {
      setAnnotation(spanConfig, typeContainer, annotationData, {
        text: 'Currently, the document is empty. Use the "import" button or press the key "i" to open a document with annotation.'
      }, params.get('config'))
    }
  }
}

function setAnnotation(spanConfig, typeContainer, annotationData, annotation, config) {
  const ret = setConfigInAnnotation(spanConfig, typeContainer, annotation)

  if (ret === 'no config') {
    setConfigFromServer(spanConfig, typeContainer, annotationData, config, annotation)
  } else {
    annotationData.reset(annotation)
  }
}

function setConfigInAnnotation(spanConfig, typeContainer, annotation) {
  spanConfig.reset()
  setSpanAndTypeConfig(spanConfig, typeContainer, annotation.config)

  if (!annotation.config) {
    return 'no config'
  }
}

function setConfigFromServer(spanConfig, typeContainer, annotationData, config, annotation) {
  spanConfig.reset()

  if (typeof config === 'string') {
    ajaxAccessor
      .getAsync(config,
        configFromServer => {
          setSpanAndTypeConfig(spanConfig, typeContainer, configFromServer)
          annotationData.reset(annotation)
        }, () => alert('could not read the span configuration from the location you specified.: ' + config)
      )
  } else {
    annotationData.reset(annotation)
  }
}

function setSpanAndTypeConfig(spanConfig, typeContainer, config) {
  spanConfig.set(config)
  setTypeConfig(typeContainer, config)
}

function setTypeConfig(typeContainer, config) {
  typeContainer.setDefinedEntityTypes(config ? config['entity types'] : [])
  typeContainer.setDefinedRelationTypes(config ? config['relation types'] : [])

  if (config && config.css !== undefined) {
    $('#css_area').html('<link rel="stylesheet" href="' + config.css + '"/>')
  }

  return config
}

function getStatusBar(editor, statusBar) {
  if (statusBar === 'on')
    return new StatusBar(editor)
  return {
    status: function() {}
  }
}
