var g_transferred_variables = new TranferredVariables();
var g_submitted = false;
var g_fields_state;

function TranferredVariables(){
    // These values are filled using info from the back-end at load time
    this.TEMPLATE_SUFFIX = "";
    this.SEPARATOR = "";
    this.ELEMENT_IDENTIFIERS = {};
    this.SHOWN_ELEMENTS_BY_FIELD_TYPE = {};
    this.FIELD_NAME_REGEX = null;
    this.NO_DEFAULT_RADIO_VALUE = null;
    this.MAX_SELECTBOX_SIZE = null;
    this.UPLOAD_URL = null;
    this.SAMPLETYPES_BY_ENV = {};
}

function Fields(){
    this._reserved_words = [];
    // NB: by setting the suffixes like this, I am assuming that the Fields constructor won't be
    // called until after the info is loaded from the back-end.  If that changes, this needs to change!
    this._reserved_suffixes = g_transferred_variables.RESERVED_SUFFIXES;
    this._package_fields = {};
    this._existing_field_names = {};
    this._uploaded_file_names = [];
    this._next_field_num = 0;
}

Fields.prototype.hasExistingField = function (potential_field_name){
    return this._existing_field_names[potential_field_name];
};

Fields.prototype.addExistingField = function(potential_field_name){
  if (!this.hasExistingField(potential_field_name)){
      this._existing_field_names[potential_field_name] = true;
  }
};

Fields.prototype.removeExistingField = function(field_name) {
      // remove field from existing_field_names dict
    delete this._existing_field_names[field_name];
};

Fields.prototype.getCurrentNextFieldNum = function(){
    return this._next_field_num;
};

Fields.prototype.incrementNextFieldNum = function(){
    this._next_field_num++;
};

Fields.prototype.setPackageFields = function(package_fields_list){
    var package_fields = {};
    for (var i = 0, len = package_fields_list.length; i < len; i++) {
        var curr_field_name = package_fields_list[i];
        this._package_fields[curr_field_name] = true;
        this.addExistingField(curr_field_name);
    }
};

Fields.prototype.addUploadedFileNames = function(uploaded_files_dict_list){
    for (var curr_index in uploaded_files_dict_list){
        var curr_file_dict = uploaded_files_dict_list[curr_index];
        // TODO: someday: remove hardcoding of key name
        this._uploaded_file_names.push(curr_file_dict["name"]);
    }
};

Fields.prototype.getUploadedFileNames = function(){
    return this._uploaded_file_names;
};

Fields.prototype.setReservedWords = function(raw_reserved_words_list){
    // Need special handling for null, also need to lowercase everything
    for (var i = 0, len = raw_reserved_words_list.length; i < len; i++) {
        var curr_word = raw_reserved_words_list[i];
        if (curr_word === null) {
            curr_word = "null";
        } else {
            curr_word = curr_word.toString();
        }
        this._reserved_words.push(curr_word.toLowerCase());
    }
};

Fields.prototype.getReservedWords = function(){
    return this._reserved_words;
};

Fields.prototype.getReservedSuffixes = function(){
    return this._reserved_suffixes;
};

// Dynamically generate HTML specifying input elements for a new field
function generateFieldHtml(fieldName) {
    var field_index = g_fields_state.getCurrentNextFieldNum();
    var $html = $('.fieldTemplate').clone();
    var template_id_objects = $("[id$=" + g_transferred_variables.TEMPLATE_SUFFIX + "]");

    for (var i = 0, len = template_id_objects.length; i < len; i++) {
        // change the element clone's template id to field-specific id
        var curr_object = template_id_objects[i];
        var curr_id_selector = getIdSelectorFromId(curr_object.id);
        var new_id = getNewIdentifierFromTemplateAndIndex(curr_object.id, field_index);
        var new_id_selector = getIdSelectorFromId(new_id);
        $html.find(curr_id_selector).prop('id', new_id);
        var new_object_html_element = $html.find(new_id_selector)[0];

        // if the element has a name attribute, change its element clone's name to a field-specific one
        // see https://stackoverflow.com/a/1318091
        var name_attr = $(curr_object).attr('name');
        // For some browsers, `attr` is undefined; for others,
        // `attr` is false.  Check for both.
        if (typeof name_attr !== typeof undefined && name_attr !== false) {
            var new_name = getNewIdentifierFromTemplateAndIndex(curr_object.name, field_index);
            new_object_html_element.name = new_name;
        }

        // TODO: someday: remove hard-coding of field name
        if (curr_object.id.startsWith("field_name")){
            // If current element is the field_name field, set its value to the input value
            new_object_html_element.value = fieldName;
        }
    }

    var return_val = $html.html();
    return return_val;
}

// Add events/validations to dynamically created input elements for new field
function decorateNewElements(newest_field_index) {
    for (var i = 0, len = NEW_ELEMENT_SET_UP_FUNCTIONS.length; i < len; i++) {
        NEW_ELEMENT_SET_UP_FUNCTIONS[i](newest_field_index);
    }
}

var allowed_date_formats = ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm", "YYYY-MM-DD HH", "YYYY-MM-DD", "YYYY-MM",
    "YYYY"];

// For JQuery validation plugin, custom validator functions always have
// first argument: the current value of the validated element. Second argument: the element to be validated
$.validator.addMethod("isValidDateTime", function(value, element){
    // From Austin re collection_timestamp: "The only formats allowed are:
    // yyyy-mm-dd hh:mm:ss or
    // yyyy-mm-dd hh:mm or
    // yyyy-mm-dd hh or
    // yyyy-mm-dd or
    // yyyy-mm or
    // yyyy"

    var return_val = false;  // default assumes validation failure
    for (i = 0; i < allowed_date_formats.length; i++) {
        var curr_format = allowed_date_formats[i];
        var curr_val = moment(value, curr_format, true).isValid();
        if (curr_val){
            return_val = curr_val;
            break;
        }
    }

    return this.optional(element) || return_val;
}, "DateTime must be a valid timestamp in one of these formats: " + allowed_date_formats.join(" or "));

// For JQuery validation plugin, custom validator functions always have
// first argument: the current value of the validated element. Second argument: the element to be validated
$.validator.addMethod("isValidFieldNamesList", function(value, element){
    var input_field_names = getValuesFromMultilineTextArea(value);

    var full_err_msgs = [];
    for (var i = 0; i < input_field_names.length; i++) {
        var curr_field_name = input_field_names[i];
        if (curr_field_name !== "") {
            var curr_err_msgs = validatePutativeFieldName(curr_field_name);
            if (curr_err_msgs.length > 0){
                // TODO: someday: refactor hardcoding of ul/li generation and class setting
                full_err_msgs.push(curr_field_name + ":<ul class='error_list'><li class='error_item'>" + curr_err_msgs.join("</li><li class='error_item'>") + "</li></ul>");
            }
        }
    }

    var return_val = full_err_msgs.length <= 0;
    if (full_err_msgs.length > 0){
        full_err_msgs.unshift("Please address the following issues:")
    }
    $(element).data('error_msg', full_err_msgs.join("<br />"));

    return this.optional(element) || return_val;
}, function(params, element) {
  return $(element).data('error_msg');
});

$.validator.addMethod("isNotNone", function(value, element){
    return (value !== "no_comparison");
}, "Must not be None if a threshold value has been provided.");

// For JQuery validation plugin, custom validator functions always have
// first argument: the current value of the validated element. Second argument: the element to be validated
$.validator.addMethod("hasNoDuplicates", function(value, element) {
    // get the values from the text area, split into an array
    var raw_values = getValuesFromMultilineTextArea(value);
    // https://stackoverflow.com/a/15868720
    var unique_values = raw_values.reduce(function(a,b){
        if (a.indexOf(b) < 0 ) a.push(b);
        return a;
      },[]);
    // if the length of the raw values is the same as the length of the unique
    // values, then every raw value is unique and validation passes.  Otherwise,
    // something is wrong.
    var return_val = raw_values.length === unique_values.length;

    return this.optional(element) || return_val;
}, "Must not contain duplicate items.");

function setUpDynamicPlusMinusGlyphsOnAccordionSections(){
    // From https://www.tutorialrepublic.com/twitter-bootstrap-tutorial/bootstrap-accordion.php
    // Add minus icon for collapse element which is open by default
    $(".collapse.in").each(function(){
        $(this).siblings(".panel-heading").find(".glyphicon").addClass("glyphicon-minus").removeClass("glyphicon-plus");
    });
    // Toggle plus minus icon on show hide of collapse element
    $(".collapse").on('show.bs.collapse', function(){
        $(this).parent().find(".glyphicon").removeClass("glyphicon-plus").addClass("glyphicon-minus");
    }).on('hide.bs.collapse', function(){
        $(this).parent().find(".glyphicon").removeClass("glyphicon-minus").addClass("glyphicon-plus");
    });
}

function makeFileUploadSettings(uploadUrl) {
    // From https://blueimp.github.io/jQuery-File-Upload/basic.html
    return {
        url: uploadUrl,
        dataType: 'json',
        done: function (e, data) {
            for (var curr_index in data.result.files) {
                var curr_item = data.result.files[curr_index];
                if (curr_item["error"]) {
                    // TODO: Figure out how to display as validation failure instead
                    alert(curr_item["error"]);
                } else {
                    g_fields_state.addUploadedFileNames([curr_item])
                }
            }

            var uploaded_files = g_fields_state.getUploadedFileNames();
            if (uploaded_files.length > 0) {
                // Rewrite the div that says what files have been uploaded
                // NB: I don't just use the list of files uploaded THIS TIME (i.e., data.result.files)
                // but rather use getUploadedFileNames because user can upload file(s) more than one time!
                // TODO: someday: remove hardcoding of div id
                // TODO: someday: improve/centralize generation of list html?
                $("#files").html("Uploaded files:<br /><ul><li>" +
                    g_fields_state.getUploadedFileNames().join("</li><li>") + "</li></ul>");
            }

            // NB: I do NOT care (or require) that the fields go in with the same field indexes they did in the original
            // form that we are recreating.  The only thing I care about is that they go in in the same ORDER.
            if (data.result["fields"]){
                addFields(data.result["fields"]);
            }
        },
        fail: function (ev, data) {
            if (data.jqXHR) {
                alert('Server-error:\n\n' + data.jqXHR.responseText);
            }
        },
        progressall: function (e, data) {
            var progress = parseInt(data.loaded / data.total * 100, 10);
            $('#progress .progress-bar').css(
                'width',
                progress + '%'
            );
        }
    };
}

function makeValidationSettings(){
    return {
        ignore: [],
        errorClass: "error_msg",
        rules: {
            "study_name": {
                required: true,
                pattern: /^[a-zA-Z0-9 ]*$/,
                minlength: 2,
                maxlength: 400
            },
            "metadata_mode": {
                required: true
            },
            "field_names": {
                isValidFieldNamesList: true
            },
            "files[]": {
                extension: "xlsx"
            }
        },
        messages: {
            "study_name": {
                required: "This field is required.",
                pattern: "Only letters, numbers, and spaces are permitted.",
                maxlength: "This field must be 400 characters or fewer."
            },
            "metadata_mode": {
                required: "Either 'Use Wizard' or 'Select Manually' must be selected."
            },
            "files[]": {
                extension: "Only .xlsx files produced by QIIMP may be uploaded."
            }
        },
		onfocusout: function( element ) {
            if (g_submitted){
                $('#metadata_form').valid();
            } else {
                if ( !this.checkable( element ) && ( element.name in this.submitted || !this.optional( element ) ) ) {
                    this.element( element );
                }
            }
		},
		onkeyup: function( element, event ) {

			// Avoid revalidate the field when pressing one of the following keys
			// Shift       => 16
			// Ctrl        => 17
			// Alt         => 18
			// Caps lock   => 20
			// End         => 35
			// Home        => 36
			// Left arrow  => 37
			// Up arrow    => 38
			// Right arrow => 39
			// Down arrow  => 40
			// Insert      => 45
			// Num lock    => 144
			// AltGr key   => 225
			var excludedKeys = [
				16, 17, 18, 20, 35, 36, 37,
				38, 39, 40, 45, 144, 225
			];

			if ( event.which === 9 && this.elementValue( element ) === "" || $.inArray( event.keyCode, excludedKeys ) !== -1 ) {
				return;
			} else if (g_submitted){
                $('#metadata_form').valid();
            } else if ( element.name in this.submitted || element.name in this.invalid ) {
				this.element( element );
			}
		},
        onclick: function( element ) {
            if (g_submitted){
                $('#metadata_form').valid();
            } else {
                // Click on selects, radiobuttons and checkboxes
                if (element.name in this.submitted) {
                    this.element(element);

                    // Or option elements, check parent select in that case
                } else if (element.parentNode.name in this.submitted) {
                    this.element(element.parentNode);
                }
            }
		},
        showErrors: function(errorMap, errorList) {
            var summary = "";
            if (g_submitted) {
                //g_submitted = false;
                // TODO: someday: refactor hard-coding of msg prefix, ul/li creation, class setting
                for (var curr_index in errorList){
                    // NB: ignore pycharm warning about hasOwnProperty() check per https://stackoverflow.com/a/25724382
                    var curr_item = errorList[curr_index];
                    var curr_id = curr_item.element.id;
                    var label_text = $("#label_" + curr_id).text();
                    var field_index = findFieldIndexFromNameOrId(curr_id);
                    if (field_index !== null){
                        var curr_field_name = getFieldNameValueByIndex(field_index);
                        label_text = curr_field_name + " " + label_text;
                    }
                    if (!label_text.endsWith(":")) {
                        label_text += ":";
                    }
                    var new_msg_pieces = ["<li class='error_item'>", label_text, curr_item.message, "</li>"];
                    summary += new_msg_pieces.join(" ")
                }

                if (summary !== ""){
                    summary = "Please correct the following issues:<br /><ul class='error_list'>" + summary + "</ul>";
                } else {
                    var temp = 1;
                }
            }

            $("#error_summary_div").html(summary);
            this.defaultShowErrors();
        },
        invalidHandler: function(form, validator) {
            g_submitted = true;
        },
        errorPlacement: function(error, element) {
            if (element.hasClass('error-below')) {
                var linebreak_element = $("<br />").insertAfter(element);
                error.insertAfter(linebreak_element)
            } else {
                error.insertAfter(element);
            }
          }
    };
}

function validateFormIfSubmitted(){
    if (g_submitted) {
        $('#metadata_form').valid();
    }
}

var NEW_ELEMENT_SET_UP_FUNCTIONS = [
    function(field_index) {  // set onchange handler on field type and make required
        addAlwaysRequiredRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_TYPE);
        addOnChangeEvent(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.FIELD_TYPE, resetFieldDetails);
    },
    function (field_index) { //set special onchange handler on allowed values checkboxes group
        var id_selector = getIdSelectorFromBaseNameAndFieldIndex(g_transferred_variables.ELEMENT_IDENTIFIERS.ALLOWED_MISSINGS, field_index);
        var id_and_state_selector = id_selector + " :checkbox"; //selector for all checkboxes inside group fieldset
        $(id_and_state_selector).on("change", {field_index:field_index}, updateDefaultsWithMissings);
    },
     function (field_index) { // set onchange handler for radio buttons specifying kind of default
         var name_selector = "input:radio[name='" + g_transferred_variables.ELEMENT_IDENTIFIERS.DEFAULT_OPTION + g_transferred_variables.SEPARATOR + field_index + "']";
         $(name_selector).on("change", {field_index:field_index}, enableDisableDefaultSelectsOnDefaultChange);
    },
    function (field_index) { //make data_type required and set onchange handler to update type validation of default
        addAlwaysRequiredRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.DATA_TYPE);
        addOnChangeEvent(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.DATA_TYPE, updateTypeValidationsAndUnitsDisplay);
    },
    function (field_index) { //make boolean true value required and set onchange handler to update defaults
        addAlwaysRequiredRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.TRUE_VALUE);
        addOnChangeEvent(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.TRUE_VALUE, updateDefaultsWithBooleanVals);
    },
    function (field_index) { //make boolean false value required and set onchange handler to update defaults
        addAlwaysRequiredRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.FALSE_VALUE);
        addOnChangeEvent(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.FALSE_VALUE, updateDefaultsWithBooleanVals);
    },
    function (field_index) { //make categorical values required, require values must be unique,
        // and add onchange handler to update defaults
        addAlwaysRequiredRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.CATEGORY_VALS);
        addNoDuplicatesRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.CATEGORY_VALS);
        addOnChangeEvent(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.CATEGORY_VALS, updateDefaultsWithCategories);
    },
    function (field_index){ //make minimum required if minimum comparison is not none
         addRequiredIfNotNoneRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.MINIMUM, g_transferred_variables.ELEMENT_IDENTIFIERS.MIN_COMPARE);
    },
    function (field_index){ //force minimum comparison to be something other than none if minimum is filled in
         addConditionalIsNotNoneRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.MIN_COMPARE, g_transferred_variables.ELEMENT_IDENTIFIERS.MINIMUM);
    },
    function (field_index){ //make maximum required if maximum comparison is not none
         addRequiredIfNotNoneRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.MAXIMUM, g_transferred_variables.ELEMENT_IDENTIFIERS.MAX_COMPARE);
    },
    function (field_index){ //force maximum comparison to be something other than none if maximum is filled in
         addConditionalIsNotNoneRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.MAX_COMPARE, g_transferred_variables.ELEMENT_IDENTIFIERS.MAXIMUM);
    },
    function (field_index) { //make datetime default pass datetime validation
        addDateTimeValidationRule(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.DEFAULT_DATETIME);
    },
    function (field_index) { //make status of is_unitless checkbox determine whether units textbox is enabled
        addOnChangeEvent(field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.IS_UNITLESS,
            enableDisableUnitsTextOnIsUnitlessChange);
    },
    function (field_index){ //add onclick event handler to remove button for field
        addEventHandler("click", field_index, g_transferred_variables.ELEMENT_IDENTIFIERS.REMOVE_FIELD, removeField)
    }
];

// Code to run as soon code as the document is ready to be manipulated
$(document).ready(function () {
    setUpDynamicPlusMinusGlyphsOnAccordionSections();

    // From https://blueimp.github.io/jQuery-File-Upload/basic.html
    $('#fileupload').fileupload(makeFileUploadSettings(g_transferred_variables.UPLOAD_URL)).prop('disabled', !$.support.fileInput).parent().addClass($.support.fileInput ? undefined : 'disabled');

    $("#metadata_form").validate(makeValidationSettings());

    g_fields_state = new Fields();
});
