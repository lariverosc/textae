import renderSourceDocument from './renderSourceDocument';
import getAnnotationBox from './getAnnotationBox';
import RenderAll from './RenderAll';
import renderModification from './renderModification';
import {
    EventEmitter as EventEmitter
}
from 'events';
import TypeStyle from '../TypeStyle';
import SpanRenderer from './SpanRenderer';
import GridRenderer from './GridRenderer';
import EntityRenderer from './EntityRenderer';

export default function(domPositionCaChe, relationRenderer, buttonStateHelper, typeGap, editor, model, typeContainer) {
    let emitter = new EventEmitter(),
        gridRenderer = new GridRenderer(editor, domPositionCaChe),
        entityRenderer = new EntityRenderer(editor, model, typeContainer, gridRenderer),
        spanRenderer = new SpanRenderer(
            model.annotationData,
            typeContainer.entity.isBlock,
            entityRenderer.render
        );

    entityRenderer.on('render', entity => entityRenderer.getTypeDom(entity).css(new TypeStyle(typeGap())));

    return (editor, annotationData, selectionModel) => {
        let renderAll = new RenderAll(editor, domPositionCaChe, spanRenderer, relationRenderer),
            chongeSpanOfEntity = _.compose(
                spanRenderer.change,
                entity => annotationData.span.get(entity.span)
            ),
            renderModificationEntityOrRelation = modification => {
                renderModification(annotationData, 'relation', modification, relationRenderer, buttonStateHelper);
                renderModification(annotationData, 'entity', modification, entityRenderer, buttonStateHelper);
            };

        let eventHandlers = [
            ['text.change', params => renderSourceDocument(editor, params.sourceDoc, params.paragraphs)],
            ['all.change', annotationData => {
                renderAll(annotationData);
                selectionModel.clear();
            }],
            ['span.add', spanRenderer.render],
            ['span.remove', span => {
                spanRenderer.remove(span);
                gridRenderer.remove(span.id);
                selectionModel.span.remove(modelToId(span));
            }],
            ['entity.add', entity => {
                // Add a now entity with a new grid after the span moved.
                chongeSpanOfEntity(entity);
                entityRenderer.render(entity);
            }],
            ['entity.change', entity => {
                entityRenderer.change(entity);
                chongeSpanOfEntity(entity);
            }],
            ['entity.remove', entity => {
                entityRenderer.remove(entity);
                chongeSpanOfEntity(entity);
                selectionModel.entity.remove(modelToId(entity));
            }],
            ['relation.add', relation => {
                relationRenderer.render(relation);
                emitter.emit('relation.add', relation);
            }],
            ['relation.change', relationRenderer.change],
            ['relation.remove', relation => {
                relationRenderer.remove(relation);
                selectionModel.relation.remove(modelToId(relation));
            }],
            ['modification.add', renderModificationEntityOrRelation],
            ['modification.remove', renderModificationEntityOrRelation]
        ];

        eventHandlers.forEach(eventHandler => bindeToModelEvent(emitter, annotationData, eventHandler[0], eventHandler[1]));

        return emitter;
    };
}

function modelToId(modelElement) {
    return modelElement.id;
}

function bindeToModelEvent(emitter, annotationData, eventName, handler) {
    annotationData.on(eventName, param => {
        handler(param);
        emitter.emit(eventName);
    });
}