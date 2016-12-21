var x = 0;
var y = 0;
var logo = true;

document.addEventListener('mousemove',function(event){ 
    if(logo)
        { mouseParticle(event); } 
});

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
    $('#temp').animate({left: leftValue, top: topValue}, Math.floor((Math.random() * 5)+5)*1000);
    $('#temp').animate({opacity: '0'}, 1000);
    document.getElementById('temp').setAttribute('id', "done");
    if($('#done').css('opacity') == '0')
    {
        $('#done').remove();
    }
},300);

function hover(element, id)
{
    logo = false;
    element.setAttribute('src', 'img/' + id + '-blue.png');
}
function leave(element, id)
{
    logo = true;
    element.setAttribute('src', 'img/' + id + '-white.png');
}
    
            
function mouseParticle(e)
{
    x = e.clientX;
    y = e.clientY;
    
    
    //document.getElementById('temp').style.top = Math.floor(Math.random * window.innerHeight) + 'px';
}
            
$(document).ready(function()
{
    $('#box').animate({opacity: "1"}, 4000);
    $('#description').delay(1000).animate({opacity: "1", marginTop: '0'}, 2000);
    $('#logo-box').delay(2300).animate({opacity: "1", marginTop: '0'}, 2000);
});