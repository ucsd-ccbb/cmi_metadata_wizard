function addFields(input_field_names_or_dicts){
    var new_field_nums_and_names = [];
    var is_dicts = !Array.isArray(input_field_names_or_dicts);
    var input_names_in_order = getPossibleFieldInputNamesInOrder();

    // If the input is a list and the list has nothing in it, bail out without doing anything
    if ((!is_dicts) && (input_field_names_or_dicts.length === 0)){
        return;
    }

    for (var curr_item in input_field_names_or_dicts) {
        var curr_field_dict = null;
        var curr_field_name = input_field_names_or_dicts[curr_item];
        if (is_dicts) {
            curr_field_dict = curr_field_name;
            curr_field_name = curr_field_dict[g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_NAME];
        }

        // TODO: someday: Should I run the usual validations here instead of when adding from form?
        // Basically, question is: do I trust that fields coming in from an existing spreadsheet will be valid?
        if ((curr_field_name !== "") && (!g_fields_state.hasExistingField(curr_field_name))) {
            g_fields_state.addExistingField(curr_field_name);

            var new_html = generateFieldHtml(curr_field_name);
            $('<div/>', {html: new_html}).appendTo(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_DETAILS_DIV));

            // once the new elements exist, set up events/etc
            decorateNewElements(g_fields_state.getCurrentNextFieldNum());

            if (curr_field_dict !== null) {
                // loop over each of the possible input name in field details, in order;
                // if the current input name is found in the set of input names for this field,
                // read in the value and set the form input with it.
                // Doing this loop, instead of just looping over the set of input names for this field,
                // ensures that the inputs are set in a sensible order that allows the
                // onchange events to handle interrelated conditional changes.
                for (var curr_input_name_index in input_names_in_order){
                    var curr_input_name = input_names_in_order[curr_input_name_index];
                    if (curr_input_name in curr_field_dict){
                        readInAndResetFormField(curr_field_dict, curr_input_name);
                    }
                }
            }

            new_field_nums_and_names.push([g_fields_state.getCurrentNextFieldNum(), curr_field_name]);
            g_fields_state.incrementNextFieldNum();
        }
    }

    // add new values to the select list for field_names_sel
    var field_names_sel_id_selector = getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_NAMES_SELECT);
    updateSelectWithNewCategories(field_names_sel_id_selector, new_field_nums_and_names, null, false,
        true, true, true);

    // show the div with the field names and details
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.EXISTING_FIELDS_DIV)).removeClass('hidden');
}

function getPossibleFieldInputNamesInOrder(){
    // After battling several intractable bugs, I conclude that the onchange interactions between
    // the elements are such that filling them in completely random order (as they come back in the
    // form dictionary) and trying to keep all the conditional updating sane is a losing battle.
    // I therefore decide to fill them in the order they will likely be filled in the interface.

    // I could have hardcoded this order somewhere (as a variable, or encoded in the names of the field,
    // or something) but I'm concerned that would set us  up for inscrutable future bugs when a
    // new field was added to the interface but left out of that ordered list, and thus not reloaded
    // properly.  Therefore, I decide to instead set the order by dynamically getting the order in which
    // the field detail template's input elements are present in the interface; this assumes, obviously, that
    // that order is sensible, but currently it is and I see no reason why that would need to change.

    // get the order in which to add input elements for each field
    var field_details_template_inputs_selector = getIdSelectorFromId(
        g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_DETAILS +
        g_transferred_variables.TEMPLATE_SUFFIX) + " :input";
    // ": input" gets ALL input elements, including textarea, select, etc
    var input_names_in_order = [];
    $(field_details_template_inputs_selector).each(function( index, element ) {
        input_names_in_order.push(this.name.replace(g_transferred_variables.TEMPLATE_SUFFIX, ""));
    });

    return input_names_in_order;
}

function readInAndResetFormField(curr_field_dict, curr_field_key) {
    var input_value = curr_field_dict[curr_field_key];
    var input_name= getIdentifierFromBaseNameAndFieldIndex(curr_field_key, g_fields_state.getCurrentNextFieldNum());

    // TODO: someday: refactor hard-coded square brackets
    if (curr_field_key.endsWith("[]")) {
        // TODO: someday: must find better way to place brackets ... also icky in template.html
        input_name = input_name.replace("[]", "");
        input_name = input_name + "[]";
        // assume we're dealing with values from a checkbox fieldset;
        // need to set the value separately for each checkbox
        for (var curr_checkbox_val_index in input_value){
            setFormValue(input_name, input_value[curr_checkbox_val_index], true);
        }
    } else {
        setFormValue(input_name, input_value, true);
    }
}

function setFormValue(input_name, input_value, trigger_onchange){
    var input_name_selector = "[name='" + input_name + "']";
    var input_selector = input_name_selector;
    var input_element = $(input_name_selector);
    var input_type = getElementType(input_element);

    // TODO: someday: refactor out option selector generation?
    switch(input_type) {
        case "checkbox":
            // NB: INTENTIONAL FALL-THROUGH to text case!  Do NOT add break here.
        case "radio":
            input_selector = input_name_selector + "[value='" + input_value + "']";
            $(input_selector).prop("checked", true);
            break;
        case "select":
            // NB: Don't reset input_selector: for select boxes, onchange is on select, not on option
            $(input_name_selector + " option[value='" + input_value + "']").prop("selected", true);
            break;
        case "textarea":
            $(input_name_selector).html(input_value);
            break;
        case "hidden":
            // NB: INTENTIONAL FALL-THROUGH to text case!  Do NOT add break here.
        case "text":
            $(input_name_selector).attr("value", input_value);
            break;
        default:
            throw "Unsupported input type '" + input_type + "'";
    }

    if (trigger_onchange) {
        // Manually trigger onchange event, if any, of changed form element(s)
        $(input_selector).change();
    }
}

// NB: this enables or disables the units *textbox* based on whether the "is_unitless" checkbox is unchecked or
// checked, respectively.  It does not show or hide anything; see showHideUnits for the code that shows/hides the
// whole enclosing units *div* based on what data type was selected.
function enableDisableUnitsText(field_index){
    var is_unitless_id_selector = getIdSelectorFromBaseNameAndFieldIndex(
        g_transferred_variables.ELEMENT_IDENTIFIERS.IS_UNITLESS, field_index);
     var is_unitless_value = $(is_unitless_id_selector).is(":checked");

    // enable units textbox if is_unitless is FALSE; else disable it
    enableOrDisableByValue(g_transferred_variables.ELEMENT_IDENTIFIERS.UNITS, field_index, is_unitless_value, false);
}

// From https://stackoverflow.com/a/9116746
function getElementType(element){
    return element[0].tagName == "INPUT" ? element[0].type.toLowerCase() : element[0].tagName.toLowerCase();
}

function findFieldIndexFromNameOrId(field_identifier){
    var result = null;  // default: assume field has no index (like "study_name")
    var id_pieces = field_identifier.split(g_transferred_variables.SEPARATOR);
    var field_num_str = id_pieces[id_pieces.length-1];
    // Check if string contains a valid integer, per https://stackoverflow.com/a/35759874
    if (!isNaN(field_num_str) && !isNaN(parseFloat(field_num_str))){
        result = parseInt(field_num_str);
    }
    return result;
}

function getFieldNameValueByIndex(field_index) {
    var field_name_input_id_selector = getIdSelectorFromBaseNameAndFieldIndex(g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_NAME, field_index);
    var field_name_input = $(field_name_input_id_selector)[0];
    return field_name_input.value;
}

function validatePutativeFieldName(putative_field_name){
    var error_msgs = [];
    error_msgs.push(validateNameIsNotReserved(putative_field_name));
    error_msgs.push(validateNameDoesNotHaveReservedSuffix(putative_field_name));
    error_msgs.push(validateNameMatchesPattern(putative_field_name));
    error_msgs.push(validateNameIsUnique(putative_field_name));
    // (filter - JS 1.6 and above)
    error_msgs = error_msgs.filter(function(x){ return x !== null });
    return error_msgs;
}

function validateNameIsNotReserved(putative_field_name) {
    var result = null;
    // if the value in the name element appears in the list of reserved words, then it is invalid
    if (g_fields_state.getReservedWords().indexOf(putative_field_name) > -1) {
        result = "'" + putative_field_name + "' is not an allowed field name because it is a reserved word.";
    }
    return result;
}

function validateNameDoesNotHaveReservedSuffix(putative_field_name) {
    var result = null;
    // if the value in the name element ends with one of the reserved suffixes, then it is invalid
    var reserved_suffixes_list = g_fields_state.getReservedSuffixes();
    for (var i = 0; i < reserved_suffixes_list.length; i++){
        var curr_reserved_suffix = reserved_suffixes_list[i];
        if (putative_field_name.endsWith(curr_reserved_suffix)) {
            result = "'" + putative_field_name + "' is not an allowed field name because it ends with the reserved suffix '" + curr_reserved_suffix + "'.";
            break;
        }
    }
    return result;
}

function validateNameMatchesPattern(putative_field_name) {
    var result = null;
    if (!g_transferred_variables.FIELD_NAME_REGEX.test(putative_field_name)) {
        result = "Only lower-case letters, numbers, and underscores are permitted, and must not start with a number.";
    }
    return result;
}

function validateNameIsUnique(putative_field_name) {
    var result = null; // default: assume unique
    if (g_fields_state.hasExistingField(putative_field_name)){
        result = "Field name must be unique."
    }
    return result;
}

function addAlwaysRequiredRule(field_index, required_base_name) {
    var id_selector = getIdSelectorFromBaseNameAndFieldIndex(required_base_name, field_index);
    $(id_selector).rules("add", {
       required: true
    });
}

function addConditionalIsNotNoneRule(field_index, condition_base_name, required_base_name) {
    var id_selector = getIdSelectorFromBaseNameAndFieldIndex(condition_base_name, field_index);

    // For JQuery validation plugin, custom validator functions always have
    // first argument: the current value of the validated element. Second argument: the element to be validated
    $(id_selector).rules("add", {
        isNotNone: {
            depends: function (value, element) {
                return doesElementHaveValue(required_base_name, field_index);
            }
        }
    });
}

function addRequiredIfNotNoneRule(field_index, condition_base_name, required_base_name) {
    var id_selector = getIdSelectorFromBaseNameAndFieldIndex(condition_base_name, field_index);

    // For JQuery validation plugin, custom validator functions always have
    // first argument: the current value of the validated element. Second argument: the element to be validated
    $(id_selector).rules("add", {
        required:  {
            depends: function() {
                var selectbox_id_selector = getIdSelectorFromBaseNameAndFieldIndex(required_base_name, field_index);
                // TODO: someday: replace hardcoding of none-value
                // The comparison value is required only if the comparison type is not none
                return ($(selectbox_id_selector).val() !== "no_comparison");
            }
        }
    });
}

function addDateTimeValidationRule(field_index, required_base_name){
    var id_selector = getIdSelectorFromBaseNameAndFieldIndex(required_base_name, field_index);
    $(id_selector).rules("add", {
        isValidDateTime: true
    });
}


function addNoDuplicatesRule(field_index, required_base_name) {
    var id_selector = getIdSelectorFromBaseNameAndFieldIndex(required_base_name, field_index);
    $(id_selector).rules("add", {
       hasNoDuplicates: true
    });
}

function addOnChangeEvent(field_index, base_name, onChangeFunc) {
    var new_func = function (event) {
        var result = onChangeFunc(event);
        validateFormIfSubmitted();
        return result;
    };
    addEventHandler("change", field_index, base_name, new_func);
}

function addEventHandler(event_name, field_index, base_name, onEventFunc){
    var id_selector = getIdSelectorFromBaseNameAndFieldIndex(base_name, field_index);
    $(id_selector).on( event_name, {field_index:field_index}, onEventFunc)
}

function doesElementHaveValue(base_name, field_index) {
    var result = true; //default
    var element_id = getIdSelectorFromBaseNameAndFieldIndex(base_name, field_index);
    var element_val = $(element_id)[0].value;
    if (!($.trim(element_val)).length) {result = false;} // see https://stackoverflow.com/a/1854584
    return result;
}

function enableOrDisableByValue(base_name, field_index, curr_val, enable_value) {
    var element_id_selector = getIdSelectorFromBaseNameAndFieldIndex(base_name, field_index);
    enableOrDisableBySelectorAndValue(element_id_selector, curr_val, enable_value);
}

function enableOrDisableBySelectorAndValue(element_selector, curr_val, enable_value){
    if (curr_val === enable_value) {
        $(element_selector).removeAttr("disabled");
    } else {
        $(element_selector).prop('disabled', 'disabled');
    }
}

function showEnableOrHideDisable(curr_selector, do_show){
    // update the element's display state (either way)
    if (!do_show)  {
        $(curr_selector).addClass('hidden');
        $(curr_selector + ' :input').attr('disabled', true);
    } else {
        $(curr_selector).removeClass('hidden');
        // Note this enables everything.  If you need to have somethings still disabled,
        // go back afterwards and (re-)disable them
        $(curr_selector + ' :input').removeAttr('disabled');
        $(curr_selector).slideDown();
    }
}

function resetSelectedOptionIfDisabled(select_id_selector){
    var selected_option = $(select_id_selector).find('option:selected');
    var disabled_val = selected_option.attr('disabled');
    var enabled = (disabled_val === false) || (disabled_val === undefined);

    // if the currently selected option is now disabled, reset which option is selected to be the
    // placeholder option
    if (!enabled) {$(select_id_selector).val("");}
}

function updateSelectWithNewCategories(select_id_selector, values_list, selected_value, add_placeholder,
                                       list_has_dual_values, retain_existing, fixed_size){
    function build_option_str(new_val, new_text, is_selected) {
        var selected_str = "";
        if (is_selected) {selected_str = "selected"}
        return '<option value="' + new_val + '" ' + selected_str + '>' + new_text + '</option>'
    }

    // add new options
    var new_options = [];
    if (add_placeholder === null) {add_placeholder = true;}
    if (add_placeholder) {
        new_options.push(build_option_str("", "--Select One--", false))
    }

    if (retain_existing) {
        // first add the existing options to the "new options" list
        new_options.push($(select_id_selector).html());
    }

    for (var i = 0; i < values_list.length; i++) {
        var new_val = values_list[i];
        var new_text = new_val;
        if (list_has_dual_values) {
            new_val = values_list[i][0];
            new_text = values_list[i][1];
        }

        var is_selected = (new_val === selected_value);
        new_options.push(build_option_str(new_val, new_text, is_selected));
    }

    $(select_id_selector).html(new_options.join(''));
    var num_options = values_list.length;
    if (fixed_size){
        num_options = null;
    }
    setSelectSize(select_id_selector, num_options);
}

// num_options is optional.  If you want the select box to be the minimum of the number of options or the max size,
// include this argument.  If you want the select box to always be the max size, just pass null for this argument.
function setSelectSize(select_id_selector, num_options){
    var size = g_transferred_variables.MAX_SELECTBOX_SIZE;
    if (num_options !== null) {
        // set the size of the select box to be the number of categories or the max
        size = Math.min(num_options, g_transferred_variables.MAX_SELECTBOX_SIZE)
    }
    $(select_id_selector).attr('size', size)
}

function getTemplateFromBaseIdentifier(base_name){
    return base_name + g_transferred_variables.TEMPLATE_SUFFIX;
}

function getIdSelectorFromBaseNameAndFieldIndex(base_name, field_index) {
    var id = getIdentifierFromBaseNameAndFieldIndex(base_name, field_index);
    return getIdSelectorFromId(id);
}

function getIdentifierFromBaseNameAndFieldIndex(base_name, field_index) {
    var full_template_name = getTemplateFromBaseIdentifier(base_name);
    return getNewIdentifierFromTemplateAndIndex(full_template_name, field_index);
}

function getIdSelectorFromId(id_str) {
    return "#" + id_str;
}

function getNewIdentifierFromTemplateAndIndex(full_template_name, field_index) {
    return full_template_name.replace(g_transferred_variables.TEMPLATE_SUFFIX, g_transferred_variables.SEPARATOR + field_index.toString());
}