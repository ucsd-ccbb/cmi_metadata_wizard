// Reset displayed interface elements and data type options when field type is changed
function resetFieldDetails(event) {
    // find out what field type was selected
    var selected_field_type = $(event.target).val();
    var field_index = event.data.field_index;

    displayFieldDetails(selected_field_type, field_index);
}

// Show/hide appropriate interface elements when field type is changed
function displayFieldDetails(selected_field_type, field_index) {
    var elements_to_show = g_transferred_variables.SHOWN_ELEMENTS_BY_FIELD_TYPE[selected_field_type];

    // find all elements for the current field that were initially hidden
    var conditional_settings = $('[id$=_' + field_index + '].initially_hidden');
    for (var i = 0, len = conditional_settings.length; i < len; i++){
        // by default, assume all elements will be hidden
        var do_show = false;
        var curr_setting_id = conditional_settings[i].id;
        var curr_setting_selector = "#" + curr_setting_id;

        // if the current element IS in the list of those that should be shown for the currently selected
        // field type, then mark it so show
        for (var j = 0, len2 = elements_to_show.length; j < len2; j++) {
            var potential_element_to_show = elements_to_show[j];
            if (curr_setting_id.startsWith(potential_element_to_show)){
                do_show = true;
                break;
            }
        }
        // Note two-step approach when showing: first enable everything.
        // Then, outside loop, go back and (re-)disable default
        // selects that go with default choices that aren't actually chosen
        showEnableOrHideDisable(curr_setting_selector, do_show);
    }

    enableDisableDefaultSelectsOnFieldTypeChange(field_index);
}

function enableDisableDefaultSelectsOnFieldTypeChange(field_index){
    var default_radio_name = getIdentifierFromBaseNameAndFieldIndex(g_transferred_variables.ELEMENT_IDENTIFIERS.DEFAULT_OPTION, field_index);
    var curr_checked_option_selector = "input[name='"+ default_radio_name + "']:checked";

    // if the selected default option for the default radio button set for this index has been disabled by the field
    // change, then reset the selected option to "no default" and show/hide default-option-specific fields as needed
    if ($(curr_checked_option_selector).attr('disabled')) {
        $("input[name='" + default_radio_name +"'][value='" + g_transferred_variables.NO_DEFAULT_RADIO_VALUE +"']").prop("checked",true);
    }

    var curr_val = $(curr_checked_option_selector).val();
    enableDisableDefaultSelects(field_index, curr_val);
}

// Enable/disable appropriate subordinate input elements when type of default setting is changed
function enableDisableDefaultSelectsOnDefaultChange(event) {
    var field_index = event.data.field_index;
    var curr_val = event.target.value;
    enableDisableDefaultSelects(field_index, curr_val);
    validateFormIfSubmitted();
}

// Enable/disable select box options for allowed missing default when allowed missing checkbox(es) are changed
function updateDefaultsWithMissings(event){
    var the_target = $(event.target);
    var field_index = event.data.field_index;
    var checkbox_value = the_target.val();
    var checkbox_ischecked = the_target.is(":checked");

    var default_missings_id_selector = getIdSelectorFromBaseNameAndFieldIndex(g_transferred_variables.ELEMENT_IDENTIFIERS.DEFAULT_MISSINGS,
        field_index);
    var select_option_for_checked_val_selector = default_missings_id_selector +
        " option[value='" + checkbox_value + "']";
    enableOrDisableBySelectorAndValue(select_option_for_checked_val_selector, checkbox_ischecked, true);
    resetSelectedOptionIfDisabled(default_missings_id_selector);
    validateFormIfSubmitted();
}

// Refresh select box options for categorical default when category items text area is changed
function updateDefaultsWithCategories(event) {
    var field_index = event.data.field_index;
    var default_categorical_id_selector = getIdSelectorFromBaseNameAndFieldIndex(g_transferred_variables.ELEMENT_IDENTIFIERS.DEFAULT_CATEGORICAL,
        field_index);
    var lines = getValuesFromMultilineTextArea($(event.target).val());

    updateSelectWithNewCategories(default_categorical_id_selector, lines);
}

function getValuesFromMultilineTextArea(textarea_val) {
    // collect new options into array
    var split = textarea_val.split('\n');
    var result = [];
    for (var i = 0; i < split.length; i++) {
        if (split[i]) {
            result.push(split[i]);
        }
    }

    return result;
}

// Refresh select box options for boolean default when boolean true_value or false_value text is changed
function updateDefaultsWithBooleanVals(event){
    var field_index = event.data.field_index;
    var new_options = [];
    var base_names = [g_transferred_variables.ELEMENT_IDENTIFIERS.TRUE_VALUE, g_transferred_variables.ELEMENT_IDENTIFIERS.FALSE_VALUE];
    for (i = 0; i < base_names.length; i++) {
        var val_id_selector = getIdSelectorFromBaseNameAndFieldIndex(base_names[i], field_index);
        var found_val = $(val_id_selector).val();
        if (found_val) {new_options.push(found_val);}
    }

    var default_boolean_id_selector = getIdSelectorFromBaseNameAndFieldIndex(g_transferred_variables.ELEMENT_IDENTIFIERS.DEFAULT_BOOLEAN,
        field_index);
    updateSelectWithNewCategories(default_boolean_id_selector, new_options);
}

// Reset type validation on minimum, maximum, and continuous default when data type select is changed
function updateTypeValidationsAndUnitsDisplay(event){
    // find out what data type was selected
    var field_index = event.data.field_index;
    var data_type_value = $(event.target).val();

    updateTypeValidation(g_transferred_variables.ELEMENT_IDENTIFIERS.MINIMUM, field_index, data_type_value);
    updateTypeValidation(g_transferred_variables.ELEMENT_IDENTIFIERS.MAXIMUM, field_index, data_type_value);
    updateTypeValidation(g_transferred_variables.ELEMENT_IDENTIFIERS.DEFAULT_CONTINUOUS, field_index, data_type_value);

    // also show or hide units div based on whether or not type is datetime
    var showUnits = showHideUnits(field_index, data_type_value);
    if (showUnits){
        enableDisableUnitsText(field_index);
    }
}


function enableDisableUnitsTextOnIsUnitlessChange(event){
    var field_index = event.data.field_index;
    enableDisableUnitsText(field_index);
}


function removeField(event){
    var field_index = event.data.field_index;
    var field_name = getFieldNameValueByIndex(field_index);
    var confirm_msg = "Permanently delete the '" + field_name + "' field?";
    if (!confirm(confirm_msg)) {
        return; //do nothing if they fail to confirm
    }

    //find and remove row div for this field
    //var button_id_selector = getIdSelectorFromBaseNameAndFieldIndex(g_transferred_variables.ELEMENT_IDENTIFIERS.REMOVE_FIELD, field_index);
    //var field_div_element = $(button_id_selector).closest('.row.field');
    // TODO: someday: refactor hard-code of field_details prefix
    // TODO: handle case where there is no item matching the selector?
    var curr_field_details_id_selector = getIdSelectorFromId(getIdentifierFromBaseNameAndFieldIndex("field_details", field_index));
    $(curr_field_details_id_selector).remove();

    // remove field from field_names selectbox
    var select_options_string = g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_NAMES_SELECT + " option";
    var select_option_id_string = select_options_string + "[value='" + field_index + "']";
    var select_option_id_selector = getIdSelectorFromId(select_option_id_string);
    $(select_option_id_selector).remove();

    // if there are no custom fields left, then hide existing fields details div
    var select_options_id_selector = getIdSelectorFromId(select_options_string);
    if ($(select_options_id_selector).length === 0) {
        $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.EXISTING_FIELDS_DIV)).addClass('hidden');
    }

    // remove field from list of existing field names
    g_fields_state.removeExistingField(field_name);
}

// NB: This function doesn't enable or disable ANYTHING--all it does is show and hide.  This is because hidden inputs
// need to remain enabled so they can be validated even when hidden (by overriding the default "ignore" setting on the
// jquery validator.  Conversely, blocks that are shown may still contain elements within them that remain disabled,
// and those should NOT be validated.
function onSelectedFieldNameChange(element) {
    var selected_field_num = element.value;

    // Loop over each potential field number
    var max_field_num = g_fields_state.getCurrentNextFieldNum();
    for (var i = 0; i < max_field_num; i++) {
        // make the selector for this field_details_#
        // TODO: someday: refactor hard-code of field_details prefix
        var curr_field_details_id_selector = getIdSelectorFromId(getIdentifierFromBaseNameAndFieldIndex("field_details", i));
        // if this is the selected field number
        // NB: ignore pycharm lint complaint here!
        // I actively WANT type-conversion at this point, as the selected field num is really a string ...
        if (i == selected_field_num) {
            $(curr_field_details_id_selector).removeClass('hidden');
        } else {
            // TODO: handle case where there is no item matching the selector
            // (note there may NOT be--list can be sparse if the user deletes any fields)
            $(curr_field_details_id_selector).addClass('hidden');
        }
    }
}

// when someone clicks to add a field, a new set of elements
// is added to represent that new field and *its* events are set up
function clickAddField(element) {
    var field_names_id_selector = getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_NAMES);
    if (!$(field_names_id_selector).valid()) {
        // if the field names list is NOT valid, quit without making any new fields
        return
    }

    var input_field_names = getValuesFromMultilineTextArea($(field_names_id_selector).val());
    addFields(input_field_names);

    // empty the values that were in the textarea
    $(field_names_id_selector).val('');
}