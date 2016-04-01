import getTargetSpanWhenFocusNodeDifferentFromAnchorNode from './getTargetSpanWhenFocusNodeDifferentFromAnchorNode'
import shrinkSpanToSelection from './shrinkSpanToSelection'

export default function(editor, annotationData, selectionModel, command, spanAdjuster, selection, spanConfig) {
  const spanId = getTargetSpanWhenFocusNodeDifferentFromAnchorNode(annotationData, selectionModel, selection)

  if (spanId) {
    selectionModel.clear()
    shrinkSpanToSelection(editor, annotationData, command, spanAdjuster, spanId, selection, spanConfig)
  }
}
