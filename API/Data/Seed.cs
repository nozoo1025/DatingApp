using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using API.Entities;
using Microsoft.AspNetCore.Identity;
using Newtonsoft.Json;

namespace API.Data {
    public class Seed {
        public static async Task SeedUsers(UserManager<AppUser> userManager, RoleManager<AppRole> roleManager) {
            if (!userManager.Users.Any()) {
                var userData = System.IO.File.ReadAllText("Data/UserSeedData.json");
                var users = JsonConvert.DeserializeObject<List<AppUser>>(userData);

                var roles = new List<AppRole> {
                    new AppRole { Name = "Member" },
                    new AppRole { Name = "Admin" },
                    new AppRole { Name = "Moderator" }
                };

                foreach (var role in roles) {
                    await roleManager.CreateAsync(role);
                }

                foreach (var user in users) {
                    await userManager.CreateAsync(user, "Pa$$w0rd");
                    await userManager.AddToRoleAsync(user, "Member");
                }

                var adminUser = new AppUser {
                    UserName = "Admin"
                };

                var result = await userManager.CreateAsync(adminUser, "Pa$$w0rd");
                if (result.Succeeded) {
                    var admin = await userManager.FindByNameAsync("Admin");
                    await userManager.AddToRolesAsync(admin, new[] { "Admin", "Moderator" });
                }
            }
        }
    }
}