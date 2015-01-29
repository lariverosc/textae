var dismissBrowserSelection = require('./dismissBrowserSelection');

module.exports = function(editor, model, spanConfig, command, modeAccordingToButton, typeContainer) {
	var handler = {
			changeTypeOfSelected: null,
			getSelectedIdEditable: null,
			// The Reference to content to be shown in the pallet.
			typeContainer: null,
			// A Swithing point to change a behavior when relation is clicked.
			jsPlumbConnectionClicked: null
		},
		emitter = require('../../util/extendBindable')({}),
		unbindAllEventhandler = function() {
			return editor
				.off('mouseup', '.textae-editor__body')
				.off('mouseup', '.textae-editor__span')
				.off('mouseup', '.textae-editor__span_block')
				.off('mouseup', '.textae-editor__type-label')
				.off('mouseup', '.textae-editor__entity-pane')
				.off('mouseup', '.textae-editor__entity');
		},
		changeType = function(getSelectedAndEditable, createChangeTypeCommandFunction, newType) {
			var ids = getSelectedAndEditable();
			if (ids.length > 0) {
				var commands = ids.map(function(id) {
					return createChangeTypeCommandFunction(id, newType);
				});

				command.invoke(commands);
			}
		},
		getSelectionSnapShot = function() {
			var selection = window.getSelection(),
				snapShot = {
					anchorNode: selection.anchorNode,
					anchorOffset: selection.anchorOffset,
					focusNode: selection.focusNode,
					focusOffset: selection.focusOffset,
					range: selection.getRangeAt(0)
				};

			dismissBrowserSelection();

			// Return the snap shot of the selection.
			return snapShot;
		},
		cancelSelect = function() {
			emitter.trigger('cancel.select');
		},
		noEdit = function() {
			unbindAllEventhandler();

			handler.typeContainer = null;
			handler.changeTypeOfSelected = null;
			handler.getSelectedIdEditable = null;
			handler.jsPlumbConnectionClicked = null;
		},
		editRelation = function() {
			var entityClickedAtRelationMode = function(e) {
					if (!model.selectionModel.entity.some()) {
						model.selectionModel.clear();
						model.selectionModel.entity.add($(e.target).attr('title'));
					} else {
						// Cannot make a self reference relation.
						var subjectEntityId = model.selectionModel.entity.all()[0];
						var objectEntityId = $(e.target).attr('title');

						if (subjectEntityId === objectEntityId) {
							// Deslect already selected entity.
							model.selectionModel.entity.remove(subjectEntityId);
						} else {
							model.selectionModel.entity.add(objectEntityId);
							_.defer(function() {
								command.invoke([command.factory.relationCreateCommand({
									subj: subjectEntityId,
									obj: objectEntityId,
									type: typeContainer.relation.getDefaultType()
								})]);

								if (e.ctrlKey || e.metaKey) {
									// Remaining selection of the subject entity.
									model.selectionModel.entity.remove(objectEntityId);
								} else if (e.shiftKey) {
									dismissBrowserSelection();
									model.selectionModel.entity.remove(subjectEntityId);
									model.selectionModel.entity.add(objectEntityId);
									return false;
								} else {
									model.selectionModel.entity.remove(subjectEntityId);
									model.selectionModel.entity.remove(objectEntityId);
								}
							});
						}
					}
					return false;
				},
				// Select or deselect relation.
				// This function is expected to be called when Relation-Edit-Mode.
				selectRelation = function(jsPlumbConnection, event) {
					var relationId = jsPlumbConnection.getParameter("id");

					if (event.ctrlKey || event.metaKey) {
						model.selectionModel.relation.toggle(relationId);
					} else {
						// Select only self
						if (model.selectionModel.relation.single() !== relationId) {
							model.selectionModel.clear();
							model.selectionModel.relation.add(relationId);
						}
					}
				},
				returnFalse = function() {
					return false;
				};

			return function() {
				// Control only entities and relations.
				// Cancel events of relations and theier label.
				// Because a jQuery event and a jsPlumb event are both fired when a relation are clicked.
				// And jQuery events are propergated to body click events and cancel select.
				// So multi selection of relations with Ctrl-key is not work.
				unbindAllEventhandler()
					.on('mouseup', '.textae-editor__entity', entityClickedAtRelationMode)
					.on('mouseup', '.textae-editor__relation, .textae-editor__relation__label', returnFalse)
					.on('mouseup', '.textae-editor__body', cancelSelect);

				handler.typeContainer = typeContainer.relation;
				handler.getSelectedIdEditable = model.selectionModel.relation.all;
				handler.changeTypeOfSelected = _.partial(changeType, handler.getSelectedIdEditable, command.factory.relationChangeTypeCommand);

				handler.jsPlumbConnectionClicked = selectRelation;
			};
		}(),
		editEntity = function() {
			var selectEnd = require('./SelectEnd')(editor, model, command, modeAccordingToButton, typeContainer),
				bodyClicked = function() {
					var selection = window.getSelection();

					// No select
					if (selection.isCollapsed) {
						cancelSelect();
					} else {
						selectEnd.onText({
							spanConfig: spanConfig,
							selection: getSelectionSnapShot()
						});
					}
				},
				selectSpan = function() {
					var getBlockEntities = function(spanId) {
							return _.flatten(
								model.annotationData.span.get(spanId)
								.getTypes()
								.filter(function(type) {
									return typeContainer.entity.isBlock(type.name);
								})
								.map(function(type) {
									return type.entities;
								})
							);
						},
						operateSpanWithBlockEntities = function(method, spanId) {
							model.selectionModel.span[method](spanId);
							if (editor.find('#' + spanId).hasClass('textae-editor__span--block')) {
								getBlockEntities(spanId).forEach(model.selectionModel.entity[method]);
							}
						},
						selectSpanWithBlockEnities = _.partial(operateSpanWithBlockEntities, 'add'),
						toggleSpanWithBlockEnities = _.partial(operateSpanWithBlockEntities, 'toggle');

					return function(event) {
						var firstId = model.selectionModel.span.single(),
							target = event.target,
							id = target.id;

						if (event.shiftKey && firstId) {
							//select reange of spans.
							model.selectionModel.clear();
							model.annotationData.span.range(firstId, id)
								.forEach(function(spanId) {
									selectSpanWithBlockEnities(spanId);
								});
						} else if (event.ctrlKey || event.metaKey) {
							toggleSpanWithBlockEnities(id);
						} else {
							model.selectionModel.clear();
							selectSpanWithBlockEnities(id);
						}
					};
				}(),
				spanClicked = function(event) {
					var selection = window.getSelection();

					// No select
					if (selection.isCollapsed) {
						selectSpan(event);
						return false;
					} else {
						selectEnd.onSpan({
							spanConfig: spanConfig,
							selection: getSelectionSnapShot()
						});
						// Cancel selection of a paragraph.
						// And do non propagate the parent span.
						event.stopPropagation();
					}
				},
				labelOrPaneClicked = function(ctrlKey, $typeLabel, $entities) {
					var selectEntities = function($entities) {
							$entities.each(function() {
								model.selectionModel.entity.add($(this).attr('title'));
							});
						},
						deselectEntities = function($entities) {
							$entities.each(function() {
								model.selectionModel.entity.remove($(this).attr('title'));
							});
						};

					dismissBrowserSelection();

					if (ctrlKey) {
						if ($typeLabel.hasClass('ui-selected')) {
							deselectEntities($entities);
						} else {
							selectEntities($entities);
						}
					} else {
						model.selectionModel.clear();
						selectEntities($entities);
					}
					return false;
				},
				typeLabelClicked = function(e) {
					var $typeLabel = $(e.target);
					return labelOrPaneClicked(e.ctrlKey || e.metaKey, $typeLabel, $typeLabel.next().children());
				},
				entityClicked = function(e) {
					dismissBrowserSelection();

					var $target = $(e.target);
					if (e.ctrlKey || e.metaKey) {
						model.selectionModel.entity.toggle($target.attr('title'));
					} else {
						model.selectionModel.clear();
						model.selectionModel.entity.add($target.attr('title'));
					}
					return false;
				},
				entityPaneClicked = function(e) {
					var $typePane = $(e.target);
					return labelOrPaneClicked(e.ctrlKey || e.metaKey, $typePane.prev(), $typePane.children());
				},
				createEntityChangeTypeCommand = function(id, newType) {
					return command.factory.entityChangeTypeCommand(
						id,
						newType,
						typeContainer.entity.isBlock(newType)
					);
				};

			return function() {
				unbindAllEventhandler()
					.on('mouseup', '.textae-editor__body', bodyClicked)
					.on('mouseup', '.textae-editor__span', spanClicked)
					.on('mouseup', '.textae-editor__type-label', typeLabelClicked)
					.on('mouseup', '.textae-editor__entity-pane', entityPaneClicked)
					.on('mouseup', '.textae-editor__entity', entityClicked);

				handler.typeContainer = typeContainer.entity;
				handler.getSelectedIdEditable = model.selectionModel.entity.all;
				handler.changeTypeOfSelected = _.partial(
					changeType,
					handler.getSelectedIdEditable,
					createEntityChangeTypeCommand
				);

				handler.jsPlumbConnectionClicked = null;
			};
		}();

	return _.extend({
		handler: handler,
		start: {
			noEdit: noEdit,
			editRelation: editRelation,
			editEntity: editEntity
		}
	}, emitter);
};