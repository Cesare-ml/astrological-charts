

export class SkinManager {
    
    public static skins = {
        'dark': {
            'bgColor': '#333',
            'elementi': [
                '#ff0000',
                '#29cc09',
                '#ffc400',
                '#90a0ff',
            ],
            'cerchioAspetti': {
                'coloreTexture': "#333",
                'texture': null,
                'imgRisuonatoreSolare': 'risuonatore-solare-vetro-satinato.png',
                'imgRisuonatoreSolareWidth':2222,
                'imgRisuonatoreSolareHeight':2222,
                'imgRisuonatoreColore': "#2a2a2a",
                'imgRisuonatoreScale': 2.43,
                "imgRisuonatoreSolareOpacity": 0.4
            },
            'anelloElementiCelesti': {
                'coloreLinea': "#636363",
                'coloreSimboli': "white",
                'coloreImgFolder': "bianco",
            },
            'anelloSegni': {
                'coloreLinea': "#aaa",
                'coloreSimboli': "elementi",
                'coloreImgFolder': null,
                'coloreTexture': "white",
                'texture': null
            },
            'anelloCase': {
                'coloreLinea': '#555',
                'coloreSimboli': "elementi",
                'coloreImgFolder': null,//'bianco',
                'texture': null,
            },
            'anelloTransiti': {
                'coloreLinea': "#636363",
                'coloreImgFolder': "bianco",
                //'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
            },
            latitudini: {
                elementiCelesti: {
                    coloreGriglia: '#444',
                    coloreEclittica: '#ff7979'
                }
            }
        },
        'dark-bn': {
            'bgColor': '#000',
            'elementi': [
                '#ff0000',
                '#29cc09',
                '#ffc400',
                '#90a0ff',
            ],
            'cerchioAspetti': {
                'coloreTexture': "#000",
                'texture': null,
                'monocoloreLineeAspetti': '#fff',
                'imgRisuonatoreSolare': 'risuonatore-solare-bn.png',
                'imgRisuonatoreSolareWidth':2222,
                'imgRisuonatoreSolareHeight':2222,
                'imgRisuonatoreColore': "#666",
                'imgRisuonatoreScale': 2.43,
                "imgRisuonatoreSolareOpacity": 0.6
            },
            'anelloElementiCelesti': {
                'coloreLinea': "#aaa",
                'coloreSimboli': "#fff",
                'coloreImgFolder': "bianco",
            },
            'anelloSegni': {
                'coloreLinea': "#aaa",
                'coloreSimboli': "#fff",
                'coloreImgFolder': null,
                'coloreTexture': "white",
                'texture': null
            },
            'anelloCase': {
                'coloreLinea': '#aaa',
                'coloreSimboli': "#fff",
                'coloreImgFolder': null,//'bianco',
                'texture': null,
            },
            'anelloTransiti': {
                'coloreLinea': "#aaa",
                'coloreImgFolder': "bianco",
                //'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
            },
            latitudini: {
                elementiCelesti: {
                    coloreGriglia: '#444',
                    coloreEclittica: '#ffffff'
                }
            }
        },
        'light': {
            'bgColor': '#fefefe',
            'elementi': [
                '#ff0000',
                '#29cc09',
                '#ffc400',
                '#6e67cc',
            ],
            'cerchioAspetti': {
                'coloreTexture': "white",
                'texture': null,
                'imgRisuonatoreSolare': 'risuonatore-solare-vetro-satinato.png',
                'imgRisuonatoreSolareWidth':2222,
                'imgRisuonatoreSolareHeight':2222,
                'imgRisuonatoreColore': "#fcfcfc",
                'imgRisuonatoreScale': 2.43,
                "imgRisuonatoreSolareOpacity": 0.4
            },
            'anelloElementiCelesti': {
                'coloreLinea': "#cccccc",
                'coloreSimboli': "#505050",
                'coloreImgFolder': "nero",
            },
            'anelloSegni': {
                'coloreLinea': "#555",
                'coloreSimboli': "elementi",
                'coloreImgFolder': 'bianco',
                'coloreTexture': "white",
                'texture': null
            },
            'anelloCase': {
                'coloreLinea': '#aaa',
                'coloreSimboli': "elementi",
                'coloreImgFolder': null,//'bianco',
                'texture': null,
            },
            'anelloTransiti': {
                'coloreLinea': "#aaa",
                'coloreImgFolder': "nero",
                //'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
            },
            latitudini: {
                elementiCelesti: {
                    coloreGriglia: '#e0e0e0',
                    coloreEclittica: '#ff7979'
                }
            }
        },
        'light-bn': {
            'bgColor': '#fefefe',
            'elementi': [
                '#ff0000',
                '#29cc09',
                '#ffc400',
                '#6e67cc',
            ],
            'cerchioAspetti': {
                'coloreTexture': "white",
                'texture': null,
                'imgRisuonatoreSolare': 'risuonatore-solare-bn.png',
                'imgRisuonatoreSolareWidth':2222,
                'imgRisuonatoreSolareHeight':2222,
                'imgRisuonatoreColore': "#ddd",
                'imgRisuonatoreScale': 2.43,
                "imgRisuonatoreSolareOpacity": 0.6
            },
            'anelloElementiCelesti': {
                'coloreLinea': "#cccccc",
                'coloreSimboli': "#505050",
                'coloreImgFolder': "nero",
            },
            'anelloSegni': {
                'coloreLinea': "#555",
                'coloreSimboli': "#505050",
                'coloreImgFolder': 'bianco',
                'coloreTexture': "white",
                'texture': null
            },
            'anelloCase': {
                'coloreLinea': '#aaa',
                'coloreSimboli': "#505050",
                'coloreImgFolder': null,//'bianco',
                'texture': null,
            },
            'anelloTransiti': {
                'coloreLinea': "#aaa",
                'coloreImgFolder': "nero",
                //'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
            },
            latitudini: {
                elementiCelesti: {
                    coloreGriglia: '#e0e0e0',
                    coloreEclittica: "#505050"
                }
            }
        },
        'sun': {
            'bgColor': '#fff',
            'elementi': [
                '#ff0000',
                '#29cc09',
                '#ffc400',
                '#6e67cc',
            ],
            'cerchioAspetti': {
                'coloreTexture': "white",
                'texture': "assets/img/textures/texture-oro-3.webp",
                'imgRisuonatoreSolare': 'risuonatore-solare-vetro-satinato.png',
                'imgRisuonatoreSolareWidth':2222,
                'imgRisuonatoreSolareHeight':2222,
                'imgRisuonatoreColore': "#e9ca75",
                'imgRisuonatoreScale': 2.43,
                "imgRisuonatoreSolareOpacity": 0.4
            },
            'anelloElementiCelesti': {
                'coloreLinea': "#333",
                'coloreSimboli': "white",
                'coloreImgFolder': "nero",
            },
            'anelloSegni': {
                'coloreLinea': "#0b3668",
                'coloreSimboli': "white",
                'coloreImgFolder': null,
                'coloreTexture': "#eff9ff",
                //'texture': "https://static3.depositphotos.com/1000401/206/i/450/depositphotos_2064086-stock-illustration-rendered-silver.jpg"
                //'texture': "assets/img/textures/texture-cielo-1.jpg",
                //'texture': "https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L25zMTc0MjUtaW1hZ2Uta3d2eWF1ejEuanBn.jpg"
                //'texture': "https://www.shutterstock.com/image-photo/beautiful-warm-glossy-light-yellow-260nw-1395756029.jpg"
                //'texture': "https://t4.ftcdn.net/jpg/05/54/68/23/360_F_554682346_ix6REAj3rJwlL1Y2RBEUyf5KPO9ZXZHb.jpg"
                //'texture': "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBw0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ8NDQ0NFREWFhURExUYHSggGBolGxUVITEhJSkrOjoxFys/OToxQzQtLisBCgoKDQ0NDg0NFy0ZFRktKy0tKy0rKy0rLTArLSswKystLS0rKy0rLSstLisrKy0rKys3LSsrNysrKysrLSsrK//AABEIALcBEwMBIgACEQEDEQH/xAAcAAEBAQEBAAMBAAAAAAAAAAAAAQIDBAUGBwj/xAApEAEBAQABAwMDBAIDAAAAAAAAARECAwRREhORBRQhMVJhoQZBBwhi/8QAFwEBAQEBAAAAAAAAAAAAAAAAAAECA//EABYRAQEBAAAAAAAAAAAAAAAAAAARAf/aAAwDAQACEQMRAD8A/UOPFuQkakaclkXCRrASRcXFwVFhigsWI1BcGoiiqqKCxWTQaGdNBo1nTQaTU00GhnTQaGdXQUTQFSiUCKzDQVCsg0M6A8kajMaRluLicW4KmC0AXDFxQFxcFRVkXAJFIICYoDI1hgMjcheIMI1YmKAYsgINek9IMquGAhRABKArNUBkVAeaNRmLBluNMxqCq0zGoKNRIsBVSKAqCCiANCANKzF0VQAMZ9LQDOLIGiKJqC1VxldBLGbG9QRn0pjYDnhjZgMYNKDwRuMRqKw3GpGY3BcaisyqjTUVlYo1FZVBpLCKCYYoCAAKgC6agC6ammgomgKqGgI0mAmmliYAGLgILiABgDxSNQkakVkjUJxanEUimLgoshFAVBBV1kBdNQBdNQBQAAAAAAQGtNQBdVmKCiAKrIDSU1ARUAeeNRmNwRViNQVcVIAqoaBhhqwERu8UwGRcMBBrEwEFwwEFkWcQTUb9B6AjA36D0gwuLhICyFi4aLGcMbAjGGNgkYTGwIxg2BHkaiAjcajEqwVsZUFABY0yoNQTTRWkxNXQMMNNAww1NBoZUGhk0GhnTQVDUBUAFEABNNEqiKCiIK4ESVRFwIoDUZUGhFBTUAaGQGjUAXRAFNTUBrTUAXVZAU1AF1NQBdNQBdNRAaGQGtNQBrRkBwjUYagjcEiitLjMaAxcFgJh6W4CxjFkaAh6TIaAliYtQExGjBEGsPSEZGrxJxBJD0t+lcRYx6EvF1KUccMdLGbFSMYKAyKgCoAoAPM1EWCNRqMxoVViKDUaYjWgommiqIoAAKioAQagCggoggogCiaaCpYqA51G+UYrSIioAAAqAOQzqiNRqMflqAqooqrrIDWms6A3KusKDSxlQWpomCqayojcqxmNSooFoBFRUEAqhFEtQK5cq3WKpr6//kP+Y/Tvptk7rr5fXw4dTj0uN63LoTlLePLq8eP54cbn4t/X/T5zpdTjz48efDlOXHnxnLjy43ePLjZssv8AuY/n7/sF1ud+rdv07yvo4dh07w47fTLy6vV9Vk83J8R97/4J+r8+5+k8uh1LeXLsuvy6PC2232eUnPjNvi3lM8SKj9IENBdE1AeOdx1PMX7jn+7+gGWp3HU8xqdx1PMQCt+/z8r7/U8wAqzr8/M+F9/qeYAp7/U/gvX6nmACe/z8w9/qeZ8AFX3+p5nwnv8AU8xQE97qeZ8JO45fu/oBK17/AD8z4Pf5+YAtPuOf8LOvz8z4AD3+fmfCe/z8z4AF+45/wXuOfiAB9xz8RfuOfiACfcc/4PuOfiAB7/P+Evcc/EoA+L+rfROz72y932nQ69nHlxnLqcZeXHjf1nHl+sdvpP07tey4e32na9Dt+H42dLp8eHqz9Lys/Nv5v6+QEe/7i/tn9J91P2z4AWk7j/xxACv/2Q=="
            },
            'anelloCase': {
                'coloreLinea': '#7dbaff',
                'coloreSimboli': "white",
                'coloreImgFolder': null,//'nero',
                //'texture': "https://t4.ftcdn.net/jpg/05/54/68/23/360_F_554682346_ix6REAj3rJwlL1Y2RBEUyf5KPO9ZXZHb.jpg"
                //'texture': "https://static.vecteezy.com/system/resources/thumbnails/011/891/413/small/abstract-background-with-overlap-layer-and-dynamic-shadow-on-background-background-for-wallpaper-banner-background-eps-10-vector.jpg",    
            },
            'anelloTransiti': {
                'coloreLinea': "#333",
                'coloreImgFolder': 'nero',
                //'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
            },
            latitudini: {
                elementiCelesti: {
                    coloreGriglia: '#7dbaff',
                    coloreEclittica: '#ff7979'
                }
            }
        },
        'astrolabio': {
            'bgColor': '#fff',
            'elementi': [
                '#ffc978',
                '#bbff00',
                '#ffe89c',
                '#bcdfff',
            ],/*
            'elementi': [
                '#ffd0b0',
                '#dcfa8b',
                '#ffe285',
                '#bcd4ff',
            ],/*
            'elementi': [
                '#753002',
                '#4d6804',
                '#664f02',
                '#420068',
            ],*/
            'cerchioAspetti': {
                'coloreTexture': "white",
                'texture': "assets/img/textures/texture-oro-3.webp",
                'imgRisuonatoreSolare': 'risuonatore-solare-vetro-satinato.png',
                'imgRisuonatoreSolareWidth':2222,
                'imgRisuonatoreSolareHeight':2222,
                'imgRisuonatoreColore': "#e9ca75",
                'imgRisuonatoreScale': 2.43,
                "imgRisuonatoreSolareOpacity": 0.4
            },
            'anelloElementiCelesti': {
                'coloreLinea': "#cfa852",
                'coloreSimboli': "#77552f",
                'coloreImgFolder': "bianco",
                'sinastria': {
                    'coloreLinea': "#925d0e",
                    'coloreSimboli': "#ffebd3",
                    'coloreImgFolder': "bianco",
                }
            },
            'anelloSegni': {
                'coloreLinea': "#925d0e",
                //'coloreSimboli': "elementi",
                //'coloreSimboli': "#77552f",
                'coloreSimboli': "#ffebd3",
                'coloreImgFolder': "bianco",
                'coloreTexture': "#c9a267",
                'texture': "assets/img/textures/texture-oro-1.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
                "sinastria": null
            },
            'anelloCase': {
                'coloreLinea': "#e0bf78",
                'coloreSimboli': "#754f24",
                'coloreImgFolder': 'bianco',
                'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://png.pngtree.com/thumb_back/fh260/background/20230512/pngtree-close-up-of-a-wood-texture-image_2507211.jpg"
                'sinastria': {
                    'coloreLinea': "#e7af5a",
                    'coloreSimboli': "#ffebd3",
                    'coloreImgFolder': 'bianco',
                    'coloreTexture': "#c9a267",
                    'texture': "assets/img/textures/texture-oro-2.jpg",
                }
            },
            'anelloTransiti': {
                'coloreLinea': "#a17f34",
                'coloreImgFolder': 'bianco',
                'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
            },
            latitudini: {
                elementiCelesti: {
                    coloreGriglia: '#ffcb5c',
                    coloreEclittica: '#ff7979'
                }
            }
        },
        'astrolabio-girasole': {
            'bgColor': '#fff',
            'elementi': [
                '#ffc978',
                '#bbff00',
                '#ffe89c',
                '#bcdfff',
            ],/*
            'elementi': [
                '#ffd0b0',
                '#dcfa8b',
                '#ffe285',
                '#bcd4ff',
            ],/*
            'elementi': [
                '#753002',
                '#4d6804',
                '#664f02',
                '#420068',
            ],*/
            'cerchioAspetti': {
                'coloreTexture': "white",
                'texture': null,//"assets/img/textures/texture-oro-3.webp",
                'imgRisuonatoreSolare': 'risuonatore-solare-vetro-giallo-satinato.png',
                'imgRisuonatoreSolareWidth':2222,
                'imgRisuonatoreSolareHeight':2222,
                //'imgRisuonatoreColore': "#e9ca75",
                'imgRisuonatoreColore': "white",
                'imgRisuonatoreScale': 2.43,
                "imgRisuonatoreSolareOpacity": 1
            },
            'anelloElementiCelesti': {
                'coloreLinea': "#cfa852",
                'coloreSimboli': "#77552f",
                'coloreImgFolder': "bianco",
                'sinastria': {
                    'coloreLinea': "#925d0e",
                    'coloreSimboli': "#ffebd3",
                    'coloreImgFolder': "bianco",
                }
            },
            'anelloSegni': {
                'coloreLinea': "#925d0e",
                //'coloreSimboli': "elementi",
                //'coloreSimboli': "#77552f",
                'coloreSimboli': "#ffebd3",
                'coloreImgFolder': "bianco",
                'coloreTexture': "#c9a267",
                'texture': "assets/img/textures/texture-oro-1.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
                "sinastria": null
            },
            'anelloCase': {
                'coloreLinea': "#ffcd60",
                'coloreSimboli': "#754f24",
                'coloreImgFolder': 'bianco',
                'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://png.pngtree.com/thumb_back/fh260/background/20230512/pngtree-close-up-of-a-wood-texture-image_2507211.jpg"
                'sinastria': {
                    'coloreLinea': "#e7af5a",
                    'coloreSimboli': "#ffebd3",
                    'coloreImgFolder': 'bianco',
                    'coloreTexture': "#c9a267",
                    'texture': "assets/img/textures/texture-oro-2.jpg",
                }
            },
            'anelloTransiti': {
                'coloreLinea': "#a17f34",
                'coloreImgFolder': 'bianco',
                'texture': "assets/img/textures/texture-oro-2.jpg",
                //"https://media.istockphoto.com/id/882080910/it/foto/sfondo-texture-oro-marrone.jpg?s=612x612&w=0&k=20&c=SXyUMH1npdwZ5WeNtKW2290YbCE1EnWmj2Ky_vel6XI="
            },
            latitudini: {
                elementiCelesti: {
                    coloreGriglia: '#ffcb5c',
                    coloreEclittica: '#ff7979'
                }
            }
        }
    };
}
