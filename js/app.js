$(document).ready(function(){
    var pattern = Trianglify({
                height: window.innerHeight,
                width: window.innerWidth,
                cell_size: 100,
                x_colors: 'Purples'
            });
            document.body.appendChild(pattern.canvas());
 
    $('.button').css("left", (window.innerWidth/2 - 23));
    $('.button2').css("left", (window.innerWidth/2 - 23));
    $('.button').css("top", (window.innerHeight - 60));
    $('a').css("top", (window.innerHeight * 8/7) + 100);
    $('h5').css("top", (window.innerHeight * 8/7) + 150);
    $('.button2').css("top", (window.innerHeight * 2 - 60));
    $('#about').css("height", window.innerHeight);
    $('#about').css("margin-top", (window.innerHeight - 375)/3);
    $('h1').hide();
    $('.button').hide();
    $('.button2').hide();
    $('h5').hide();
    $('a').hide();
    $('#about').hide();
    $('h1').delay(1000).fadeIn(1000);
    $('.button').delay(1400).fadeIn(700);
    $('.button2').delay(1400).fadeIn(700);
    $('h5').delay(1400).fadeIn(700);
    $('a').delay(1400).fadeIn(700);
    $('#about').delay(1400).fadeIn(700);
});

$('#scroll').click(function(){
    $('html, body').animate({
    scrollTop: $("#about").offset().top
}, 1000);
});

$('.button').hover(function(){
    $('.button').animate({backgroundColor:'white'});
}, function(){
    $('.button').animate({backgroundColor: 'rgba(0, 0, 0, 0)'});
});

$('.button2').hover(function(){
    $('.button2').animate({backgroundColor:'#806bc9'});
}, function(){
    $('.button2').animate({backgroundColor: 'rgba(0, 0, 0, 0)'});
});