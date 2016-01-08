import SettingDialog from '../../../component/SettingDialog'
import TypeEditor from './TypeEditor'
import EditMode from './EditMode'
import DisplayInstance from './DisplayInstance'
import setDefaultEditability from './setDefaultEditability'
import ClipBoardHandler from './handlers/ClipBoardHandler'
import DefaultEntityHandler from './handlers/DefaultEntityHandler'
import removeSelectedElements from './handlers/removeSelectedElements'
import ModificationHandler from './handlers/ModificationHandler'
import SelectHandler from './handlers/SelectHandler'
import ToggleButtonHandler from './handlers/ToggleButtonHandler'
import ModeButtonHandlers from './handlers/ModeButtonHandlers'
import enableSaveButtorAtEditable from './enableSaveButtorAtEditable'

export default function(
  editor,
  model,
  view,
  command,
  spanConfig,
  clipBoard,
  buttonController,
  typeGap,
  typeContainer,
  writable,
  autocompletionWs
) {
  let typeEditor = new TypeEditor(
      editor,
      model,
      spanConfig,
      command,
      buttonController.modeAccordingToButton,
      typeContainer,
      autocompletionWs
    ),
    editMode = new EditMode(
      editor,
      model,
      typeEditor,
      buttonController.buttonStateHelper
    ),
    displayInstance = new DisplayInstance(
      typeGap,
      editMode
    ),
    defaultEntityHandler = new DefaultEntityHandler(
      command,
      model.annotationData,
      model.selectionModel,
      buttonController.modeAccordingToButton,
      spanConfig,
      typeContainer.entity
    ),
    clipBoardHandler = new ClipBoardHandler(
      command,
      model.annotationData,
      model.selectionModel,
      clipBoard
    ),
    modificationHandler = new ModificationHandler(
      command,
      model.annotationData,
      buttonController.modeAccordingToButton,
      typeEditor
    ),
    toggleButtonHandler = new ToggleButtonHandler(
      buttonController.modeAccordingToButton,
      editMode
    ),
    modeButtonHandlers = new ModeButtonHandlers(
      editMode
    ),
    selectHandler = new SelectHandler(
      editor,
      model.selectionModel
    ),
    showSettingDialog = new SettingDialog(
      editor,
      displayInstance
    ),
    editorSelected = () => {
      typeEditor.hideDialogs()

      // Select this editor.
      editor.eventEmitter.emit('textae.editor.select')
      buttonController.buttonStateHelper.propagate()
    },
    event = {
      editorSelected: editorSelected,
      copyEntities: clipBoardHandler.copyEntities,
      removeSelectedElements: () => removeSelectedElements(
        command,
        model.selectionModel,
        selectHandler
      ),
      createEntity: defaultEntityHandler.createEntity,
      showPallet: typeEditor.showPallet,
      replicate: defaultEntityHandler.replicate,
      pasteEntities: clipBoardHandler.pasteEntities,
      changeLabel: typeEditor.changeLabel,
      cancelSelect: typeEditor.cancelSelect,
      negation: modificationHandler.negation,
      speculation: modificationHandler.speculation,
      showSettingDialog: showSettingDialog
    }

  Object.assign(event, selectHandler)
  Object.assign(event, toggleButtonHandler)
  Object.assign(event, modeButtonHandlers)

  enableSaveButtorAtEditable(writable, editMode, buttonController)

  return {
    init: function(mode) {
      // The jsPlumbConnetion has an original event mecanism.
      // We can only bind the connection directory.
      editor
        .on('textae.editor.jsPlumbConnection.add', (event, jsPlumbConnection) => {
          jsPlumbConnection.bindClickAction(typeEditor.jsPlumbConnectionClicked)
        })

      defaultEntityHandler.on('createEntity', displayInstance.notifyNewInstance)
      setDefaultEditability(model.annotationData, editMode, writable, mode)
    },
    event: event
  }
}