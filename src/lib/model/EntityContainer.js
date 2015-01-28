// Expected an entity like {id: "E21", span: "editor2__S50_54", type: "Protein"}.
var idFactory = require('../util/IdFactory'),
    ModelContainer = require('./ModelContainer'),
    hogehoge = function(editor, entity) {
        return {
            id: entity.id,
            span: idFactory.makeSpanId(editor, entity.span),
            type: entity.obj,
        };
    },
    mappingFunction = function(editor, denotations) {
        denotations = denotations || [];
        return denotations.map(_.partial(hogehoge, editor));
    },
    EntityContainer = function(editor, eventEmitter, relation) {
        var entityContainer = new ModelContainer(
                eventEmitter,
                'entity',
                _.partial(mappingFunction, editor)
            ),
            add = _.compose(entityContainer.add, function(entity) {
                if (entity.span) return entity;
                throw new Error('entity has no span! ' + JSON.stringify(entity));
            }),
            assosicatedRelations = function(entityId) {
                return relation.all().filter(function(r) {
                    return r.obj === entityId || r.subj === entityId;
                }).map(function(r) {
                    return r.id;
                });
            },
            api = _.extend(entityContainer, {
                add: add,
                assosicatedRelations: assosicatedRelations
            });

        return api;
    };

module.exports = EntityContainer;
