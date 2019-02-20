var editor = ace.edit("code");
var abi, ml;
editor.setTheme("ace/theme/monokai");
editor.getSession().setMode("ace/mode/fi");
editor.session.setOption("useWorker", false);
$('docmenut').ready(function(){
  compile();
  $('button#copyMichelson').click(function(){
     copyToClipboard($("#compiled").html()); 
     alert("Compiled code has been copied");
  });
  $('button#copyAbi').click(function(){
     copyToClipboard($("#abi_text").html()); 
     alert("Compiled ABI has been copied");
  });
  $('button#clear').click(function(){
    editor.setValue("");
    $("#compiled").html("");
    $("#abi_text").html("");
    $("#stacktrace").html("");
  });
  $('button#compile').click(function(){
    $("#compiled").html("");
    compile();
  });
  $('button#run').click(function(){
    run();
  });
});
function compile(){
  var code = editor.getValue();
  if (!code) return false;
  $("#compiled").html('');
  $("#abi_text").html('');
  $("#stacktrace").html('');
  $("#inputFields").html('');
  $('#entryPoint').children('option:not(:first)').remove();
  $("#storage").attr("placeholder", "");
  try{
  var compiled = fi.compile(code);
    ml = compiled.ml;
		if ($('input#optimized').is(':checked')) {
			$("#compiled").addClass("wrapped");
		} else {
			ml = formatMl(ml);
			$("#compiled").removeClass("wrapped");
		}
    fi.abi.load(compiled.abi);
    abi = JSON.parse(compiled.abi);
		if (typeof abi.storage != 'undefined'){
			$("#storage").attr("disabled", false);
			$("#storage").attr("placeholder", fi._core.compile.namedType(abi.storage));
			$("#storageFields").html('');
			buildFields('storage', abi.storage, '#storageFields');
		}else {
			$("#storage").attr("placeholder", 'unit');
			$("#storage").val("Unit");
			$("#storage").attr("disabled", true);
		}
    $("#compiled").html(ml);
    $("#abi_text").html(compiled.abi);
    buildInputInterface();
    $('#stacktrace').html("Loading...");
    $.post("https://api.fi-code.com/typecheck", {code:ml}, function(result){
      $('#stacktrace').html(result.data.stdout);
    });
		$('#runtrace').html("Please enter input and storage above to run");
    return ml;
  } catch(e){
    $("#compiled").html(e);
    $("#abi_text").html("Error with compiler");
    $("#stacktrace").html("Error with compiler");
  }
}
var currentEntry;
function buildInputInterface(){
  $('#entryPoint').children('option:not(:first)').remove();
  for(var i = 0; i < abi.entry.length; i++){
    $("#entryPoint").append('<option value="'+i+'">'+abi.entry[i].name+'</option>');
  }
  $('#entryPoint').on('change', function() {
    if (!this.value) {
      currentEntry = false;
      return false;
    }
    currentEntry = abi.entry[this.value];
    $("#inputFields").html('');
    buildFields('input', currentEntry.input, '#inputFields');
    return true;
  });
}
function buildFields(lab, cc, id){
  for(var i = 0; i < cc.length; i++){
    var nn = lab + '.' + cc[i].name;
    if (typeof abi.struct != 'undefined'){
      ind = fi._core.helper.findInObjArray(abi.struct, 'name', cc[i].type[0]);
    } else ind = -1;
    if (ind >= 0){
      buildFields(nn, abi.struct[ind].type, id);
    } else {
      $(id).append('<div class="col-md-12"><label style="text-transform:capitalize;">'+nn+'</label><input type="text" class="form-control" name="'+nn+'" placeholder="' + fi._core.compile.type(cc[i].type) + '"></div>');
    }
  }
}
function formatMlLines(t, ti){
	var tl = 0, fm = '', lns = [], bl = 0, instring = false, escaped = false, inline = false, incode = [];
	for(var i = 0; i < t.length; i++){
		if (t[i] == '{') {
			bl++;
			if (bl == 1) {
				if (incode.length == 0){
					inline = true;
					lns.push(fm);
					fm = '';
				}
				continue;
			}
		} else if (t[i] == '}') {
			bl--;
			if (bl == 0){
				incode.push(fm);
				fm = '';
				continue;
			}
		}
		else if (bl == 0){
			if (t[i] == ';') {
				if (inline){
					var fm1 = lns.pop();
					fm1 = fm1.slice(0);
					var fm2 = formatMlLines(incode.shift(), (ti+fm1.length + 2));
					fm = fm1 + "{ " + fm2 + " }";
					while (incode.length){
						fm += "\n" + (" ").repeat(ti+fm1.length) + "{ " + formatMlLines(incode.shift(), (ti+fm1.length + 2)) + " }"
					}
					fm += ";";
					lns.push(fm);
					fm = '';
					inline = false;
					continue;
				}
				fm += ";";
				lns.push(fm);
				fm = '';
				continue;
			}
		}
		fm += t[i];
	}
	if (inline){
		var fm1 = lns.pop();
		fm1 = fm1.slice(0);
		var fm2 = formatMlLines(incode.shift(), (ti+fm1.length + 2));
		fm = fm1 + "{ " + fm2 + " }";
		while (incode.length){
			fm += "\n" + (" ").repeat(ti+fm1.length) + "{ " + formatMlLines(incode.shift(), (ti+fm1.length + 2)) + " }"
		}
		fm += ";";
		lns.push(fm);
		fm = '';
		inline = false;
	}
	if (fm) lns.push(fm);
	return lns.join("\n" + (" ").repeat(ti));
}
function formatMl(ml){
	return formatMlLines(ml, 0).replace(/; }/g, " }")
}
function run(){
  $('#runtrace').html("Loading...");
	try {
		var 
		input = fi.abi.entry(currentEntry.name, getJsonFromInput('input').input),
		storage = fi.abi.storage(getJsonFromInput('storage').storage);
		if (!storage || !input) throw "Please enter storage and input";
		$.post("https://api.fi-code.com/run", {
			code:ml,
			storage : storage,
			input : input
		}, function(result){
			if (result.success){
				console.log(result.data.stdout.split("\n")[1].trim());
				$('#runtrace').html(result.data.stdout);
			}
			else {
				console.log(result);
				$('#runtrace').html("There was an unknown error");
			}
		});
	} catch(e){
		$('#runtrace').html("Error running program, please check input and storage variables");
	}
}
function getJsonFromInput(i){
  var obj = {};
  var t = $("input[name^='"+i+"']").map(function(){
    var name = $(this).attr('name');
    return [name.split(".").concat([$(this).val()])];
  }).get();

  for (var i = 0; i < t.length; i++){
    obj = buildJson(t[i], obj);
  }
  return obj;
}
function buildJson(t, oo){
  var tn = t.shift();
  if (t.length > 1){
    if (typeof oo[tn] == 'undefined') oo[tn] = {};
    oo[tn] = buildJson(t, oo[tn]);
  } else {
    oo[tn] = t.shift();
  }
  return oo;
}
function copyToClipboard(text) {
  if (window.clipboardData && window.clipboardData.setData) {
		return clipboardData.setData("Text", text); 

  } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
		var textarea = document.createElement("textarea");
		textarea.textContent = text;
		textarea.style.position = "fixed"; 
		document.body.appendChild(textarea);
		textarea.select();
		try {
			return document.execCommand("copy"); 
		} catch (ex) {
			console.warn("Copy to clipboard failed.", ex);
			return false;
		} finally {
			document.body.removeChild(textarea);
		}
  }
}