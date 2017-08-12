/**
 * Created by guhao on 2017/8/10.
 */

/*todo:
 1. query 获取上传host
 2. 增加base64 decode 和 encode
  */

$(function() {
    var host = "http://upload.qiniu.com";
    var ctx = new Array();
    var token;


    var uploader = WebUploader.create({
        swf: "Uploader.swf",
        server: host,
        pick: "#picker",
        resize: false,
        dnd: "#theList",
        paste: document.body,
        disableGlobalDnd: true,
        thumb: {
            width: 100
            , height: 100
            , quality: 70
            , allowMagnify: true
            , crop: true
        },
        compress: false,
        prepareNextFile: true,
        chunked: true,
        chunkSize: 4194304,
        threads: true,
        fileNumLimit: 100,
        fileSingleSizeLimit: 10000 * 1024 * 1024,
        duplicate: true
    });

    uploader.on("fileQueued", function (file) {

        $("#theList").append('<li id="' + file.id + '">' +
            '<img /><span>' + file.name + '</span><span class="itemUpload">上传</span><span class="itemStop">暂停</span><span class="itemDel">删除</span>' +
            '<div class="percentage"></div>' +
            '</li>');

        var $img = $("#" + file.id).find("img");

        uploader.makeThumb(file, function (error, src) {
            if (error) {
                $img.replaceWith("<span>不能预览</span>");
            }

            $img.attr("src", src);
        });


    });


    uploader.on("uploadStart", function(file){
        $.ajax({
            async:false,
            type: 'get',
            url: 'http://localhost:8083/uptoken',
            success: function (res) {
                console.log(res);
                token = res.uptoken;
                console.log(token);
                uploader.options.formData = {
                    token : token
                }
            }
        });
    });

    uploader.on("uploadBeforeSend", function (block, data, headers) {
        console.log(parseInt(block.file.size));
        console.log(parseInt(uploader.options.chunkSize));
        console.log(block);
        if (parseInt(block.file.size) <= parseInt(uploader.options.chunkSize)) {
            uploader.options.chunked = false;
            console.log(false);
        } else {
            uploader.options.chunked = true;
            headers['Authorization'] = 'UpToken ' + token;
            headers['Content-Type'] = 'application/octet-stream';
            block.transport.options.server = host + "/mkblk/" + (block.end - block.start);
            block.transport.options.sendAsBinary = true;
            block.transport.options.formData = false;
            console.log(true);
        }
    });

    uploader.on("uploadProgress", function (file, percentage) {
        $("#" + file.id + " .percentage").text(percentage * 100 + "%");
    });

    uploader.on("uploadAccept", function (block, ret) {
        console.log("uploadAccept.............");
        console.log("block: " + block);
        console.log("ret: " + ret);
        ctx[block.chunk] = ret.ctx;
        console.log("ctx:" + ctx);
    });

    uploader.on("uploadSuccess", function(file, res) {
        console.log("uploadSuccess............");
        if(parseInt(file.size) <= parseInt(uploader.options.chunkSize)) {
            UploadComplete(file);
            console.log(res);
        }
    });

    uploader.on("uploadComplete", function (file) {
        console.log("uploadComplete............");
        if(parseInt(file.size) >= parseInt(uploader.options.chunkSize)) {
            console.log("ctx:" + ctx);
            b = ctx.join(",");
            $.ajax({
                type: 'POST',
                url: host + '/mkfile/' + file.size,
                data: b,
                contentType: "text/plain",
                contentLength: b.length,
                beforeSend: function (XMLHttpRequest) {
                    XMLHttpRequest.setRequestHeader("Authorization", 'UpToken ' + token);
                },
                success: UploadComplete(file)
            });
        }
    });


    $("#theList").on("click", ".itemUpload", function () {
        uploader.upload();

        //"上传"-->"暂停"
        $(this).hide();
        $(".itemStop").show();
    });

    $("#theList").on("click", ".itemStop", function () {
        uploader.stop(true);

        //"暂停"-->"上传"
        $(this).hide();
        $(".itemUpload").show();
    });

    $("#theList").on("click", ".itemDel", function () {
        uploader.removeFile($(this).parent().attr("id"));	//从上传文件列表中删除

        $(this).parent().remove();	//从上传列表dom中删除
    });


    function UploadComplete(file) {
        console.log(file);
        ctx = new Array();
        uploader.options.chunked = true;
        $("#" + file.id + " .percentage").text("上传完毕");
        $(".itemStop").hide();
        $(".itemUpload").hide();
        $(".itemDel").hide();
    }
});