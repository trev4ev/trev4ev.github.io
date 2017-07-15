setInterval(function(){
    var e = document.createElement('div');
    e.setAttribute('class', 'circle');
    e.setAttribute('id', 'temp');
    e.style.left = Math.floor(Math.random() * window.innerWidth) + 'px';
    e.style.top = Math.floor(Math.random() * window.innerHeight) + 'px';
    document.getElementById('body').appendChild(e);
    leftValue =  Math.floor(Math.random() * window.innerWidth) + "px";
    topValue = Math.floor(Math.random() * window.innerHeight) + "px";
    $('#temp').animate({opacity: '0.4'}, 200);
    $('#temp').animate({left: leftValue, top: topValue, backgroundColor: '#243071'}, Math.floor((Math.random() * 5)+5)*1000);
    $('#temp').animate({opacity: '0'}, 1000);
    document.getElementById('temp').setAttribute('id', "done");
    if($('#done').css('opacity') == '0')
    {
        $('#done').remove();
    }
},1200);
            
$(document).ready(function()
{
});