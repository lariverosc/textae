export default function setButtonState(buttonController, editable, mode) {
    buttonController.modeAccordingToButton.view.value(!editable);
    buttonController.modeAccordingToButton.relation.value(isRelation(mode));
    buttonController.modeAccordingToButton.simple.value(mode === 'term');
    buttonController.buttonStateHelper.enabled('replicate-auto', isSpanEdit(editable, mode));
    buttonController.buttonStateHelper.enabled('boundary-detection', isSpanEdit(editable, mode));
    buttonController.modeAccordingToButton['relation-edit-mode'].value(isRelation(mode));
}

function isSpanEdit(editable, mode) {
    return editable && mode !== 'relation';
}

function isRelation(mode) {
    return mode === 'relation';
}