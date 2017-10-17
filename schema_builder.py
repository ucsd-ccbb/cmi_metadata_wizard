from enum import Enum

import metadata_package_schema_builder

SEPARATOR = "_"
TEMPLATE_SUFFIX = SEPARATOR + "template"


class InputNames(Enum):
    study_name = "study_name"
    field_name = "field_name"
    field_type = "field_type"
    allowed_missing_vals = "allowed_missing_vals[]"
    default_value = "default_value"
    allowed_missing_default_select = "allowed_missing_default_select"
    categorical_default_select = "categorical_default_select"
    continuous_default = "continuous_default"
    boolean_default_select = "boolean_default_select"
    text_default = "text_default"
    true_value = "true_value"
    false_value = "false_value"
    data_type = "data_type"
    categorical_values = "categorical_values"
    minimum_comparison = "minimum_comparison"
    minimum_value = "minimum_value"
    maximum_comparison = "maximum_comparison"
    maximum_value = "maximum_value"
    units = "units"


class FieldTypes(Enum):
    Boolean = "boolean"
    Text = metadata_package_schema_builder.CerberusDataTypes.Text.value
    Categorical = "categorical"
    Continuous = "continuous"


class DefaultTypes(Enum):
    no_default = "no_default"
    boolean_default = "boolean_default"
    allowed_missing_default = "allowed_missing_default"
    categorical_default = "categorical_default"
    continuous_default = "continuous_default"
    text_default = "text_default"


def _get_field_type_to_schema_generator():
    return {
        FieldTypes.Text.value: _generate_text_schema,
        FieldTypes.Boolean.value: _generate_boolean_schema,
        FieldTypes.Categorical.value: _generate_categorical_schema,
        FieldTypes.Continuous.value: _generate_continuous_schema
    }


def _get_default_types_to_input_fields():
    return {
        DefaultTypes.no_default.value: None,
        DefaultTypes.boolean_default.value: InputNames.boolean_default_select.value,
        DefaultTypes.allowed_missing_default.value: InputNames.allowed_missing_default_select.value,
        DefaultTypes.categorical_default.value: InputNames.categorical_default_select.value,
        DefaultTypes.continuous_default.value: InputNames.continuous_default.value,
        DefaultTypes.text_default.value: InputNames.text_default.value
    }


def get_validation_schema(curr_field_from_form):
    field_name = curr_field_from_form[InputNames.field_name.value]
    validation_schema = _build_single_validation_schema_dict(curr_field_from_form)

    if InputNames.allowed_missing_vals.value in curr_field_from_form:
        allowed_missing_vals_from_form = curr_field_from_form[InputNames.allowed_missing_vals.value]
        # NB: allowed_missing_vals from form are the *names* of the ebi missing values (like "ebi_not_collected"
        # instead of "missing: not collected" because the punctuation/etc in the actual values causes some problems with
        # my jquery selectors.  Thus, it is necessary to convert them from name to value before use in validation schema
        allowed_missing_vals = [_convert_ebi_missing_name_to_ebi_missing_value(x) for x in
                                allowed_missing_vals_from_form]
        curr_schema = {}
        missings_schema = _generate_text_schema(None)
        missings_schema.update({
            metadata_package_schema_builder.ValidationKeys.allowed.value: allowed_missing_vals
        })

        missings_schema = _set_default_keyval_if_any(curr_field_from_form, missings_schema)
        curr_schema[metadata_package_schema_builder.ValidationKeys.anyof.value] = [missings_schema, validation_schema]
    else:
        curr_schema = validation_schema
        curr_schema = _set_default_keyval_if_any(curr_field_from_form, curr_schema)
    # end if any allowed missing vals

    return field_name, curr_schema


def _build_single_validation_schema_dict(curr_field_from_form):
    generator_funcs_by_type = _get_field_type_to_schema_generator()
    field_type = curr_field_from_form[InputNames.field_type.value]
    schema_generator_func = generator_funcs_by_type[field_type]
    result = schema_generator_func(curr_field_from_form)

    fixed_use_input_names = [e.value for e in InputNames]
    for curr_key, curr_value in curr_field_from_form.items():
        if curr_key not in fixed_use_input_names:
            result.update({curr_key: curr_value})

    return result


def _generate_basic_schema():
    return {
        metadata_package_schema_builder.ValidationKeys.empty.value: False,
        metadata_package_schema_builder.ValidationKeys.required.value: True
    }


def _generate_text_schema(curr_field_from_form):
    curr_schema = _generate_basic_schema()
    curr_schema.update({
        metadata_package_schema_builder.ValidationKeys.type.value:
            metadata_package_schema_builder.CerberusDataTypes.Text.value
    })
    return curr_schema


def _generate_boolean_schema(curr_field_from_form):
    bool_true = curr_field_from_form[InputNames.true_value.value]
    bool_false = curr_field_from_form[InputNames.false_value.value]

    curr_schema = _generate_text_schema(curr_field_from_form)
    curr_schema.update({
        metadata_package_schema_builder.ValidationKeys.allowed.value: [bool_true, bool_false]
    })
    return curr_schema


def _generate_categorical_schema(curr_field_from_form):
    cast_func, curr_schema = _create_schema_for_data_type(curr_field_from_form)

    categorical_vals_str = curr_field_from_form[InputNames.categorical_values.value]
    split_categorical_vals = categorical_vals_str.split("\r\n")
    split_categorical_vals = [x.strip() for x in split_categorical_vals]

    typed_categorical_vals = [cast_func(x) for x in split_categorical_vals]

    curr_schema.update({
        metadata_package_schema_builder.ValidationKeys.allowed.value: typed_categorical_vals
    })
    return curr_schema


def _generate_continuous_schema(curr_field_from_form):
    _, curr_schema = _create_schema_for_data_type(curr_field_from_form)

    curr_schema = _set_comparison_keyval_if_any(curr_field_from_form,
                                                InputNames.minimum_value.value,
                                                InputNames.minimum_comparison.value, curr_schema)

    curr_schema = _set_comparison_keyval_if_any(curr_field_from_form,
                                                InputNames.maximum_value.value,
                                                InputNames.maximum_comparison.value, curr_schema)

    return curr_schema


def _create_schema_for_data_type(curr_field_from_form):
    func_by_type_str = {metadata_package_schema_builder.CerberusDataTypes.Text.value: str,
                        metadata_package_schema_builder.CerberusDataTypes.Decimal.value: float,
                        metadata_package_schema_builder.CerberusDataTypes.Integer.value: int}

    data_type = curr_field_from_form[InputNames.data_type.value]
    cast_func = func_by_type_str[data_type]

    curr_schema = _generate_basic_schema()
    curr_schema.update({
        metadata_package_schema_builder.ValidationKeys.type.value: data_type
    })

    return cast_func, curr_schema


def _set_default_keyval_if_any(curr_field_from_form, curr_schema):
    default_types_to_default_fields = _get_default_types_to_input_fields()
    default_type_value = curr_field_from_form[InputNames.default_value.value]
    default_value_input_name = default_types_to_default_fields[default_type_value]
    if default_value_input_name is not None:
        default_val = curr_field_from_form[default_value_input_name]
        if default_val in [x.name for x in metadata_package_schema_builder.EbiMissingValues]:
            default_val = _convert_ebi_missing_name_to_ebi_missing_value(default_val)
        curr_schema[metadata_package_schema_builder.ValidationKeys.default.value] = default_val
    return curr_schema


def _set_comparison_keyval_if_any(curr_field_from_form, threshold_val_name, comparison_val_name, curr_schema):
    if threshold_val_name in curr_field_from_form:
        comparison_value = curr_field_from_form[threshold_val_name]
        comparison_key = curr_field_from_form[comparison_val_name]
        curr_schema.update({
            comparison_key: comparison_value
        })
    # end if there's a threshold value
    return curr_schema


def _convert_ebi_missing_name_to_ebi_missing_value(ebi_missing_name):
    return metadata_package_schema_builder.EbiMissingValues[ebi_missing_name].value