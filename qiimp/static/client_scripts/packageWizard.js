function onModeChange(element){
    // TODO: someday: remove hardcoding of div names, etc
    var mode_divs = ["power_div", "wizard_div"];
    var selected_mode = element.value;
    var div_to_display_basename = selected_mode.replace("metadata_mode_","");
    var div_to_display = div_to_display_basename + "_div";

    var existing_package_info = _getEnvAndSampleTypeFromHiddenFields();
    if (existing_package_info !== null){
        var confirm_msg = "Changing the package selection method will remove all package fields and any custom fields. Go ahead?";
        if (!confirm(confirm_msg)){
            return;
        }
    }

    resetFieldsAndDivs(null);

    for (var i = 0, len = mode_divs.length; i < len; i++){
        var curr_mode_div = mode_divs[i];
        var curr_mode_div_selector = getIdSelectorFromId(curr_mode_div);
        var do_show = false; // default to false
        if (curr_mode_div === div_to_display){
          do_show = true;
        } else {
            // if this is NOT the div to display, unselect any selected values for any selectboxes in this div
            var selectboxes_selector = curr_mode_div_selector + " select";
            $(selectboxes_selector).each(function() {
                $(this).val("");
            });
        }
        showEnableOrHideDisable(curr_mode_div_selector, do_show);
    }

    // once user has picked a route, enable the select package button
    enableOrDisableBySelectorAndValue(getIdSelectorFromId("select_package_button"), true, true);
    validateFormIfSubmitted();
}

function onHostChange(event){
    var selected_host = $(event.target).val();
    // TODO: flesh out with getting two-value list
    var values_list = g_transferred_variables.SAMPLETYPES_BY_ENV[selected_host];
    updateSelectWithNewCategories("#sample_type_select", values_list, null, false,
                                       true, false, true);

    // show the sampletype div
    showEnableOrHideDisable(getIdSelectorFromId("sample_type_div"), true);
}

function onSelectPackage(){
    var package_info = determinePackageInfo();
    if (package_info === null) {
        return false;
    }

    // If the user re-chose the SAME package, do nothing
    var existing_package_info = _getEnvAndSampleTypeFromHiddenFields();
    if (existing_package_info === package_info){
        return;
    }

    // If any custom fields have been added, warn the user they will be cleared by replacing the package
    if (g_fields_state.getCurrentNextFieldNum() > 0) {
        var confirm_msg = "Changing the package selection will remove all custom fields.  Clear existing custom fields and change package?";
        if (!confirm(confirm_msg)) {
            return; //do nothing if they fail to confirm
        }
    }

    resetFieldsAndDivs(package_info);

    // Make an ajax call to get the list of field names for this package and the list of reserved words
    $.ajax({
        url : g_transferred_variables.PACKAGE_PARTIAL_URL,
        type : 'POST',
        data : package_info,
        dataType: 'json',
        success : ajax_ok,
        error: ajax_err
    });
}

function determinePackageInfo(){
    var package_info = null;
    var package_select_id_selector = getIdSelectorFromId("package_select");
    var sampletype_select_id_selector = getIdSelectorFromId("sample_type_select");
    var host_select_id_selector = getIdSelectorFromId("host_select");

    // check the "power user" value--the precise, organism-specific package to use
    if (!$(package_select_id_selector).is(':disabled')) {
        var valid_pkg = $(package_select_id_selector).valid();
        if (valid_pkg) {
            var combination_str = $(package_select_id_selector).val();
            var package_info_pieces = combination_str.split(" ");
            package_info = makePackageInfoDict(package_info_pieces[0], package_info_pieces[1])
        }
    } else {
        var valid_sampletype = $(sampletype_select_id_selector).valid();
        var valid_host = $(host_select_id_selector).valid();
        if (valid_sampletype && valid_host) {
            // get the host type and the sample type and paste them together to get the package name to look for
            var env = $(host_select_id_selector).val();
            var sample_type = $(sampletype_select_id_selector).val();
            package_info = makePackageInfoDict(env, sample_type);
        }
    }

    return package_info;
}

function makePackageInfoDict(env, sample_type){
    var result = {};
    result[g_transferred_variables.ELEMENT_IDENTIFIERS.ENV_FIELD] = env;
    result[g_transferred_variables.ELEMENT_IDENTIFIERS.SAMPLE_TYPE_FIELD] = sample_type;
    return result;
}

function resetFieldsAndDivs(package_info){
    // hide field_details_div, custom_fields_div, show no_package_warning_div
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.EXISTING_FIELDS_DIV)).addClass('hidden');
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.CUSTOM_FIELDS_DIV)).addClass('hidden');
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.NO_PACKAGE_WARNING_DIV)).removeClass('hidden');

    // clear field_names_sel, field_details_div, which contains the custom fields, and package_details_div
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_NAMES_SELECT)).empty();
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_DETAILS_DIV)).empty();
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.PACKAGE_DETAILS_DIV)).empty();

    // TODO: someday: remove hardcoding of div name
    $("#files").empty();

    // Reset variables tracking field information
    g_fields_state = new Fields();
    _setEnvAndSampleTypeToHiddenFields(package_info)
}

function _getEnvAndSampleTypeFromHiddenFields(){
    var result = null;
    var env_val = $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.ENV_FIELD)).val();
    var sample_type_val = $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.SAMPLE_TYPE_FIELD)).val();
    if ((env_val !== "") || (sample_type_val !== "")) {
        result = makePackageInfoDict(env_val, sample_type_val)
    }
    return result;
}

function _setEnvAndSampleTypeToHiddenFields(env_and_sample_type_dict){
    var env_val = "";
    var sample_type_val = "";
    if (env_and_sample_type_dict !== null){
        env_val = env_and_sample_type_dict[g_transferred_variables.ELEMENT_IDENTIFIERS.ENV_FIELD];
        sample_type_val = env_and_sample_type_dict[g_transferred_variables.ELEMENT_IDENTIFIERS.SAMPLE_TYPE_FIELD];
    }
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.ENV_FIELD)).val(env_val);
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.SAMPLE_TYPE_FIELD)).val(sample_type_val);
}

function ajax_err(request, error) {
    console.log(request);
    console.log(error);
}

function ajax_ok(data) {
    // Set the reserved words
    g_fields_state.setReservedWords(data["reserved_words"]);

    // Set the package field names
    var package_field_names_list = data["field_names"];
    g_fields_state.setPackageFields(package_field_names_list);

    var field_desc_dicts_list = data["field_descriptions"];
    var field_descs_html_pieces = [];
    for (var i = 0; i < field_desc_dicts_list.length; i++) {
        var curr_desc_dict = field_desc_dicts_list[i];
        var curr_desc_html = "<tr><td class='description-cell'>" + curr_desc_dict["name"]+
            "</td><td class='description-cell'>" + curr_desc_dict["description"] + "</td></tr>";
        field_descs_html_pieces.push(curr_desc_html);
    }
    var fields_message = "<br /><p>The following fields will be added to your metadata template:</p><table>" +
        field_descs_html_pieces.join("") +
        "</table><br /><strong>Note that none of these fields' names will be available for custom fields.</strong><br /><br />";
    $(getIdSelectorFromId("package_details_div")).html(fields_message);

    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.NO_PACKAGE_WARNING_DIV)).addClass('hidden');
    $(getIdSelectorFromId(g_transferred_variables.ELEMENT_IDENTIFIERS.CUSTOM_FIELDS_DIV)).removeClass('hidden');
}