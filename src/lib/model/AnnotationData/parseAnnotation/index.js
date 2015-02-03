var validateAnnotation = require('./validateAnnotation'),
    importAnnotation = require('./importAnnotation'),
    parseAnnotation = function(span, entity, relation, modification, text, annotation, prefix) {
        var result = validateAnnotation(text, annotation);

        importAnnotation(span,
            entity,
            relation,
            modification,
            result.accept.denotation,
            result.accept.relation,
            result.accept.modification,
            prefix
        );

        return result.reject;
    };

module.exports = parseAnnotation;
