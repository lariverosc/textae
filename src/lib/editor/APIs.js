export default function(command, presenter, dataAccessObject, history, annotationData, buttonController, view, updateLineHeight) {
    let keyApiMap = new KeyApiMap(command, presenter, dataAccessObject, history, annotationData),
        iconApiMap = new IconApiMap(command, presenter, dataAccessObject, history, annotationData, buttonController, updateLineHeight);

    // Update APIs
    return {
        handleKeyInput: (key, value) => handle(keyApiMap, key, value),
        handleButtonClick: (key, value) => handle(iconApiMap, key, value),
        redraw: () => view.updateDisplay()
    };
}

function handle(map, key, value) {
    if (map[key]) map[key](value);
}

function KeyApiMap(command, presenter, dataAccessObject, history, annotationData) {
    let showAccess = () => dataAccessObject.showAccess(history.hasAnythingToSave()),
        showSave = () => dataAccessObject.showSave(annotationData.toJson()),
        keyApiMap = {
            'A': command.redo,
            'B': presenter.event.toggleDetectBoundaryMode,
            'C': presenter.event.copyEntities,
            'D': presenter.event.removeSelectedElements,
            'DEL': presenter.event.removeSelectedElements,
            'E': presenter.event.createEntity,
            'F': presenter.event.toggleRelationEditMode,
            'I': showAccess,
            'M': presenter.event.toggleRelationEditMode,
            'Q': presenter.event.showPallet,
            'R': presenter.event.replicate,
            'S': presenter.event.speculation,
            'U': showSave,
            'V': presenter.event.pasteEntities,
            'W': presenter.event.newLabel,
            'X': presenter.event.negation,
            'Y': command.redo,
            'Z': command.undo,
            'ESC': presenter.event.cancelSelect,
            'LEFT': presenter.event.selectLeftSpan,
            'RIGHT': presenter.event.selectRightSpan,
        };

    return keyApiMap;
}

function IconApiMap(command, presenter, dataAccessObject, history, annotationData, buttonController, updateLineHeight) {
    let showAccess = () => dataAccessObject.showAccess(history.hasAnythingToSave()),
        showSave = () => dataAccessObject.showSave(annotationData.toJson()),
        iconApiMap = {
            'textae.control.button.read.click': showAccess,
            'textae.control.button.write.click': showSave,
            'textae.control.button.undo.click': command.undo,
            'textae.control.button.redo.click': command.redo,
            'textae.control.button.replicate.click': presenter.event.replicate,
            'textae.control.button.replicate_auto.click': buttonController.modeAccordingToButton['replicate-auto'].toggle,
            'textae.control.button.boundary_detection.click': presenter.event.toggleDetectBoundaryMode,
            'textae.control.button.relation_edit_mode.click': presenter.event.toggleRelationEditMode,
            'textae.control.button.entity.click': presenter.event.createEntity,
            'textae.control.button.change_label.click': presenter.event.newLabel,
            'textae.control.button.pallet.click': presenter.event.showPallet,
            'textae.control.button.negation.click': presenter.event.negation,
            'textae.control.button.speculation.click': presenter.event.speculation,
            'textae.control.button.delete.click': presenter.event.removeSelectedElements,
            'textae.control.button.copy.click': presenter.event.copyEntities,
            'textae.control.button.paste.click': presenter.event.pasteEntities,
            'textae.control.button.setting.click': presenter.event.showSettingDialog,
            'textae.control.button.line_height.click': updateLineHeight
        };

    return iconApiMap;
}
