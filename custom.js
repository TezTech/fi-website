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
    fi.abi.load(compiled.abi);
    abi = JSON.parse(compiled.abi);
    $("#storage").attr("placeholder", fi._core.compile.namedType(abi.storage));
    $("#compiled").html(ml);
    $("#abi_text").html(compiled.abi);
    buildAbiInterface();
    $('#stacktrace').html("Loading...");
    $.post("https://api.fi-code.com/typecheck", {code:ml}, function(result){
      $('#stacktrace').html(result.data.stdout);
    });
    return ml;
  } catch(e){
    $("#compiled").html(e);
    $("#abi_text").html("Error with compiler");
    $("#stacktrace").html("Error with compiler");
  }
}
var currentEntry;
function buildAbiInterface(){
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
    buildInputFields('input', currentEntry.input);
    return true;
  });
}
function buildInputFields(lab, cc){
  for(var i = 0; i < cc.length; i++){
    var nn = lab + '.' + cc[i].name;
    if (typeof abi.struct != 'undefined'){
      ind = fi._core.helper.findInObjArray(abi.struct, 'name', cc[i].type[0]);
    } else ind = -1;
    if (ind >= 0){
      buildInputFields(nn, abi.struct[ind].type);
    } else {
      $("#inputFields").append('<div class="col-md-12"><label>'+nn+'</label><input type="text" class="form-control" name="'+nn+'" placeholder="' + cc[i].type[0] + '"></div>');
    }
  }
}
function run(){
  var storage = $("#storage").val(),
  input = fi.abi.call(currentEntry.name, getJsonInput().input);
  if (!storage || !input) return alert("Please enter storage and input");;
  $('#runtrace').html("Loading...");
  $.post("https://api.fi-code.com/run", {
    code:ml,
    storage : storage,
    input : input
  }, function(result){
    if (result.success)
      $('#runtrace').html(result.data.stdout);
    else
      $('#runtrace').html("There was an unknown error");
  });
}
function getJsonInput(){
  var obj = {};
  var t = $("input[name^='input']").map(function(){
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
      // IE specific code path to prevent textarea being shown while dialog is visible.
      return clipboardData.setData("Text", text); 

  } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
      var textarea = document.createElement("textarea");
      textarea.textContent = text;
      textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
      document.body.appendChild(textarea);
      textarea.select();
      try {
          return document.execCommand("copy");  // Security exception may be thrown by some browsers.
      } catch (ex) {
          console.warn("Copy to clipboard failed.", ex);
          return false;
      } finally {
          document.body.removeChild(textarea);
      }
  }
}